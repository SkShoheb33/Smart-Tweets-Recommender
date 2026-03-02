import React, { useState, useEffect } from 'react';
import TweetCard from './TweetCard';
import { RefreshCw, Bot, X } from 'lucide-react';

const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Load saved recommendations from storage on mount
  useEffect(() => {
    chrome.storage.local.get(['savedRecommendations', 'savedUserProfile'], (result) => {
      if (result.savedRecommendations) {
        setRecommendations(result.savedRecommendations);
      }
      if (result.savedUserProfile) {
        setUserProfile(result.savedUserProfile);
      }
    });
  }, []);

  // 2. Fetch recommendations
  const fetchRecommendations = () => {
    setLoading(true);
    setError(null);
    chrome.runtime.sendMessage({ action: 'fetch_recommendations' }, (response) => {
      setLoading(false);
      if (!response) {
        setError('Error: No response from background script.');
        return;
      }
      if (response.error) {
        setError(response.error);
        return;
      }
      if (!response.data || !response.data.recommendations || response.data.recommendations.length === 0) {
        setRecommendations([]);
        return;
      }

      const recs = response.data.recommendations;
      const profile = response.data.user_profile;

      setUserProfile(profile);
      setRecommendations(recs);

      // Save to storage
      chrome.storage.local.set({
        savedRecommendations: recs,
        savedUserProfile: profile
      });
    });
  };

  return (
    <>
      {/* Floating Action Button */ }
      <button
        onClick={ () => setIsSidebarOpen(true) }
        className="fixed top-0 right-0 z-[2147483647] bg-[#1d9bf0] text-white p-2 m-4 rounded-full shadow-[0_4px_16px_rgba(29,155,240,0.5)] hover:bg-[#1a8cd8] hover:scale-105 transition-all duration-200 flex items-center justify-center group cursor-pointer border-none"
        title="Open Twitter Agent"
      >
        <Bot className="w-7 h-7" />
        <span className="absolute right-0 mr-3 bg-[rgba(0,0,0,0.8)] text-white text-sm px-3 py-1.5 rounded-md font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Agent Feed
        </span>
      </button>

      {/* Sidebar Overlay (Darkens background slightly) */ }
      { isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[2147483646] backdrop-blur-sm transition-opacity"
          onClick={ () => setIsSidebarOpen(false) }
        />
      ) }

      {/* Sliding Sidebar */ }
      <div
        className={ `fixed top-0 right-0 h-screen w-[420px] bg-[#000000] border-l border-[rgb(47,51,54)] z-[2147483647] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}` }
      >
        {/* Header */ }
        <div className="sticky top-0 bg-[rgba(0,0,0,0.85)] backdrop-blur-md border-b border-[rgb(47,51,54)] p-4 flex justify-between items-center z-10">
          <h2 className="text-[#e7e9ea] font-bold text-xl flex items-center gap-2 m-0">
            <Bot className="w-6 h-6 text-[#1d9bf0]" />
            Agent Recommendations
          </h2>
          <button
            onClick={ () => setIsSidebarOpen(false) }
            className="text-[#71767b] hover:text-[#e7e9ea] hover:bg-[rgba(255,255,255,0.1)] p-2 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */ }
        <div className="px-4 py-3 border-b border-[rgb(47,51,54)] flex justify-between items-center bg-[rgba(255,255,255,0.02)] shrink-0">
          <span className="text-[#71767b] text-[14px]">Your personalized feed</span>
          <button
            onClick={ fetchRecommendations }
            disabled={ loading }
            className="flex items-center gap-2 bg-[#e7e9ea] hover:bg-[#d7dbdc] text-black px-4 py-1.5 rounded-full font-bold text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer"
          >
            <RefreshCw className={ `w-4 h-4 ${loading ? 'animate-spin' : ''}` } />
            { loading ? 'Running...' : 'Run Agent' }
          </button>
        </div>

        {/* Feed Content */ }
        <div className="flex-1 overflow-y-auto">
          { loading && recommendations.length === 0 && (
            <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#1d9bf0]" />
              <span>Analyzing tweets and generating recommendations...<br />This may take a minute.</span>
            </div>
          ) }

          { error && (
            <div className="p-6 text-center text-[#f4212e] bg-[rgba(244,33,46,0.1)] m-4 rounded-xl border border-[#f4212e]/20">
              <p className="font-bold mb-2 m-0">Agent Error</p>
              <p className="m-0 text-[14px]">{ error }</p>
              <p className="mt-3 text-sm text-[#e7e9ea] m-0">Make sure you run <code className="bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded font-mono">python server.py</code> in the project root.</p>
            </div>
          ) }

          { !loading && !error && recommendations.length === 0 && (
            <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-3">
              <Bot className="w-12 h-12 text-[#71767b]/50" />
              <span>No recommendations found.<br />Click "Run Agent" to start analyzing.</span>
            </div>
          ) }

          { recommendations.length > 0 && (
            <div className="flex flex-col pb-6">
              { userProfile && (
                <div className="p-4 border-b border-[rgb(47,51,54)] bg-[rgba(29,155,240,0.05)] mx-4 mt-4 rounded-xl border border-[#1d9bf0]/20 mb-2">
                  <h4 className="text-[#1d9bf0] font-bold mb-2 text-[14px] m-0 flex items-center gap-1.5">
                    <Bot className="w-4 h-4" /> Profile Persona:
                  </h4>
                  <p className="text-[14px] text-[#e7e9ea] leading-relaxed m-0">{ userProfile }</p>
                </div>
              ) }

              <div className="mt-2">
                { recommendations.map((rec, index) => (
                  <TweetCard key={ index } rec={ rec } />
                )) }
              </div>
            </div>
          ) }
        </div>
      </div>
    </>
  );
};

export default App;
