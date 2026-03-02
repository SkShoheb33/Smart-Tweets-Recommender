$(document).ready(function () {
    // Inject sidebar
    const $sidebar = $('<div>', { id: 'twitter-agent-sidebar' })
        .addClass('fixed top-0 -right-[450px] w-[400px] h-screen bg-[#15202b] text-white z-[999999] transition-[right] duration-300 ease-in-out shadow-[-2px_0_15px_rgba(0,0,0,0.5)] overflow-y-auto font-sans')
        .appendTo('body');

    // Inject toggle button
    const $toggleBtn = $('<button>', { id: 'twitter-agent-toggle', title: 'Show Agent Recommendations' })
        .text('🤖')
        .addClass('fixed top-6 right-6 w-14 h-14 rounded-full bg-[#1d9bf0] text-white border-none text-[28px] cursor-pointer z-[999998] shadow-[0_4px_12px_rgba(29,155,240,0.4)] flex items-center justify-center transition-transform duration-200 ease-in-out hover:scale-105 hover:bg-[#1a8cd8]')
        .appendTo('body');

    $toggleBtn.on('click', function () {
        if ($sidebar.hasClass('right-0')) {
            $sidebar.removeClass('right-0').addClass('-right-[450px]');
        } else {
            $sidebar.removeClass('-right-[450px]').addClass('right-0');
            loadRecommendations();
        }
    });

    function loadRecommendations() {
        $sidebar.empty().append(`
            <div class="flex justify-between items-center px-5 py-4 border-b border-[#38444d] bg-[#15202b]/95 backdrop-blur-[10px] sticky top-0 z-10">
                <h3 class="m-0 text-lg font-bold">Agent Recommendations</h3>
                <button id="close-btn" class="bg-transparent border-none text-[#8899a6] text-lg cursor-pointer p-1 rounded-full hover:bg-white/10 hover:text-white transition-colors">✖</button>
            </div>
            <div id="recs-content" class="p-4">
                <div class="text-center py-8 text-[#8899a6]">Loading recommendations...</div>
            </div>
        `);

        $('#close-btn').on('click', function () {
            $sidebar.removeClass('right-0').addClass('-right-[450px]');
        });

        chrome.runtime.sendMessage({ action: 'fetch_recommendations' }, function (response) {
            const $content = $('#recs-content');

            if (!response) {
                $content.html('<div class="text-center py-8 text-[#f4212e]">Error: No response from background script.</div>');
                return;
            }

            if (response.error) {
                $content.html(`
                    <div class="text-center py-8 text-[#f4212e]">
                        <p>Error: ${response.error}</p>
                        <p>Make sure you run <code class="bg-[#2b1114] px-1.5 py-0.5 rounded font-mono">python server.py</code> in the project root.</p>
                    </div>`);
                return;
            }

            if (!response.data || !response.data.recommendations || response.data.recommendations.length === 0) {
                $content.html('<div class="text-center py-8 text-[#8899a6]">No recommendations found. Run the agent first!</div>');
                return;
            }

            const recs = response.data.recommendations;
            let html = '';

            // Add User Profile
            if (response.data.user_profile) {
                html += `
                    <div class="bg-[#1c2732] border border-[#38444d] rounded-xl p-4 mb-5">
                        <h4 class="m-0 mb-2.5 text-[#1d9bf0] text-[15px] font-bold">User Profile</h4>
                        <p class="m-0 text-[14px] leading-relaxed text-[#e1e8ed]">${response.data.user_profile}</p>
                    </div>
                `;
            }

            // Add Recommendations
            html += recs.map(rec => `
                <div class="bg-transparent border border-[#38444d] rounded-2xl p-4 mb-4 transition-colors duration-200 hover:bg-white/[0.03]">
                    <div class="inline-block bg-[#1d9bf0] text-white px-2.5 py-1 rounded-full text-[13px] font-bold mb-3">Score: ${rec.score}/10</div>
                    <div class="text-[#8899a6] text-[14px] mb-2 font-medium">@${rec.created_by}</div>
                    <div class="text-[15px] leading-relaxed mb-3 break-words whitespace-pre-wrap text-[#e1e8ed]">${rec.tweet}</div>
                    ${rec.link ? `<a href="${rec.link}" target="_blank" class="inline-block text-[#1d9bf0] no-underline text-[14px] font-medium hover:underline">View Post</a>` : ''}
                </div>
            `).join('');

            $content.html(html);
        });
    }
});