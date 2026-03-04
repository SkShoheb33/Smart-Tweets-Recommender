import React from 'react';

const SentimentPieChart = ({ positive, neutral, negative }) => {
  const posEnd = positive;
  const neuEnd = positive + neutral;
  
  return (
    <div className="flex flex-col w-full my-4 bg-[rgba(255,255,255,0.02)] p-5 rounded-xl border border-[rgb(47,51,54)] items-center">
      <h3 className="text-[#e7e9ea] font-bold text-sm mb-5 w-full text-left">Sentiment Overview</h3>
      
      <div className="flex items-center gap-8 w-full justify-center">
        <div 
          className="w-32 h-32 rounded-full shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.4)] border-4 border-[#16181c]"
          style={{
            background: `conic-gradient(
              #00ba7c 0% ${posEnd}%,
              #71767b ${posEnd}% ${neuEnd}%,
              #f4212e ${neuEnd}% 100%
            )`
          }}
        />
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#00ba7c] shadow-[0_0_5px_rgba(0,186,124,0.5)]"></div>
            <span className="text-[#e7e9ea] text-sm font-bold w-16">Positive</span>
            <span className="text-[#71767b] text-sm">{positive}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#71767b]"></div>
            <span className="text-[#e7e9ea] text-sm font-bold w-16">Neutral</span>
            <span className="text-[#71767b] text-sm">{neutral}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#f4212e] shadow-[0_0_5px_rgba(244,33,46,0.5)]"></div>
            <span className="text-[#e7e9ea] text-sm font-bold w-16">Negative</span>
            <span className="text-[#71767b] text-sm">{negative}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentPieChart;