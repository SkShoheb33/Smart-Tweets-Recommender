import React from 'react';
import TweetCard from './TweetCard';
import { RefreshCw, Bot } from 'lucide-react';

const FeedTab = ({ 
  fetchRecommendations, 
  loading, 
  error, 
  recommendations, 
  activeTopic, 
  agentStatus 
}) => {
  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-[rgb(47,51,54)] flex justify-between items-center bg-[rgba(255,255,255,0.02)] shrink-0">
        <span className="text-[#71767b] text-[14px]">Your personalized feed</span>
        <button
          onClick={ fetchRecommendations }
          disabled={ loading }
          className="flex items-center gap-2 bg-[#e7e9ea] hover:bg-[#d7dbdc] text-black px-4 py-1.5 rounded-full font-bold text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm"
        >
          <RefreshCw className={ `w-4 h-4 ${loading ? 'animate-spin' : ''}` } />
          { loading ? 'Running...' : 'Run Agent' }
        </button>
      </div>

      { loading && (
        <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[#1d9bf0]" />
          <div className="flex flex-col gap-1">
            <span className="font-bold text-[#e7e9ea]">Agent is running...</span>
            <span className="text-[14px] text-[#1d9bf0]">{ agentStatus || 'Initializing...' }</span>
          </div>
        </div>
      ) }

      { error && (
        <div className="p-6 text-center text-[#f4212e] bg-[rgba(244,33,46,0.1)] m-4 rounded-xl border border-[#f4212e]/20">
          <p className="font-bold mb-2 m-0">Agent Error</p>
          <p className="m-0 text-[14px]">{ error }</p>
        </div>
      ) }

      { !loading && !error && recommendations.length === 0 && (
        <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-3">
          <Bot className="w-12 h-12 text-[#71767b]/50" />
          <span>No recommendations found.<br />Click "Run Agent" to start analyzing.</span>
        </div>
      ) }

      { !loading && recommendations.length > 0 && (
        <div className="flex flex-col pb-6 mt-2">
          { recommendations.filter(rec => activeTopic === 'All' || rec.topic === activeTopic).map((rec, index) => (
            <TweetCard key={ index } rec={ rec } />
          )) }
        </div>
      ) }
    </div>
  );
};

export default FeedTab;