import React from 'react';
import { RefreshCw, Bot, CheckCircle2, AlertTriangle, ChevronRight, MessageSquare, Info, FileText } from 'lucide-react';
import SentimentPieChart from './SentimentPieChart';

const AnalysisTab = ({
  currentTweetId,
  analysisResult,
  analysisLoading,
  analysisError,
  analysisStatus,
  analyzePost
}) => {
  return (
    <div className="flex flex-col p-4">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[#71767b] text-sm">
          { currentTweetId ? `Ready to analyze post` : 'No post detected' }
        </span>
        <button
          onClick={ analyzePost }
          disabled={ analysisLoading || !currentTweetId }
          className="flex items-center gap-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white px-4 py-2 rounded-full font-bold text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm"
        >
          <RefreshCw className={ `w-4 h-4 ${analysisLoading ? 'animate-spin' : ''}` } />
          { analysisLoading ? 'Analyzing...' : 'Analyze Post' }
        </button>
      </div>

      { analysisLoading && (
        <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[#1d9bf0]" />
          <div className="flex flex-col gap-1">
            <span className="font-bold text-[#e7e9ea]">Agent is analyzing...</span>
            <span className="text-[14px] text-[#1d9bf0]">{ analysisStatus || 'Extracting insights...' }</span>
          </div>
        </div>
      ) }

      { analysisError && (
        <div className="p-6 text-center text-[#f4212e] bg-[rgba(244,33,46,0.1)] mb-4 rounded-xl border border-[#f4212e]/20">
          <p className="font-bold mb-2 m-0">Analysis Error</p>
          <p className="m-0 text-[14px]">{ analysisError }</p>
        </div>
      ) }

      { !analysisLoading && !analysisError && analysisResult && (
        <div className="flex flex-col gap-4 text-[#e7e9ea] space-y-5">

          {/* Summary */ }
          <div className="bg-[#16181c] p-4 rounded-2xl border border-[rgb(47,51,54)]">
            <div className="flex items-center gap-2 mb-2 text-[#1d9bf0]">
              <Bot className="w-5 h-5" />
              <h3 className="font-bold text-[15px] m-0">AI Summary</h3>
            </div>
            <p className="text-[14px] leading-relaxed m-0 text-[#e7e9ea]">{ analysisResult.summary }</p>
          </div>

          {/* Meta Stats Row */ }
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#16181c] p-3 rounded-xl border border-[rgb(47,51,54)] flex flex-col items-center text-center">
              <span className="text-[#71767b] text-xs font-bold uppercase mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00ba7c]" />
                Trust Score
              </span>
              <span className={ `text-xl font-black ${analysisResult.trust_percentage > 70 ? 'text-[#00ba7c]' : analysisResult.trust_percentage > 40 ? 'text-[#ffd400]' : 'text-[#f4212e]'}` }>
                { analysisResult.trust_percentage }%
              </span>
            </div>
            <div className="bg-[#16181c] p-3 rounded-xl border border-[rgb(47,51,54)] flex flex-col items-center text-center">
              <span className="text-[#71767b] text-xs font-bold uppercase mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#ffd400]" />
                Controversy
              </span>
              <span className="text-xl font-black text-[#e7e9ea] capitalize">
                { analysisResult.controversy_level }
              </span>
            </div>
          </div>

          {/* Sentiment Pie Chart */ }
          <SentimentPieChart
            positive={ analysisResult.sentiment?.positive_percentage || 0 }
            neutral={ analysisResult.sentiment?.neutral_percentage || 0 }
            negative={ analysisResult.sentiment?.negative_percentage || 0 }
          />

          {/* Keypoints */ }
          <div className="bg-[#16181c] p-4 rounded-2xl border border-[rgb(47,51,54)]">
            <h3 className="font-bold text-[15px] mb-3 text-[#1d9bf0] flex items-center gap-2">
              <Info className="w-4 h-4" /> Key Insights
            </h3>

            <div className="mb-4">
              <span className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-1 block">Main Claim</span>
              <p className="text-[14px] bg-[rgba(255,255,255,0.03)] p-3 rounded-lg border-l-2 border-[#1d9bf0] m-0">
                { analysisResult.keypoints?.main_claim }
              </p>
            </div>

            { analysisResult.keypoints?.supporting_arguments?.length > 0 && (
              <div className="mb-4">
                <span className="text-[#00ba7c] text-xs font-bold uppercase tracking-wider mb-2 block flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Supporting Arguments
                </span>
                <ul className="space-y-2 m-0 p-0 pl-1 list-none">
                  { analysisResult.keypoints.supporting_arguments.map((arg, i) => (
                    <li key={ i } className="text-[13px] flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-[#00ba7c] shrink-0 mt-0.5" />
                      <span className="text-[#e7e9ea]/90 leading-snug">{ arg }</span>
                    </li>
                  )) }
                </ul>
              </div>
            ) }

            { analysisResult.keypoints?.counter_arguments?.length > 0 && (
              <div className="mb-4">
                <span className="text-[#f4212e] text-xs font-bold uppercase tracking-wider mb-2 block flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Counter Arguments
                </span>
                <ul className="space-y-2 m-0 p-0 pl-1 list-none">
                  { analysisResult.keypoints.counter_arguments.map((arg, i) => (
                    <li key={ i } className="text-[13px] flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-[#f4212e] shrink-0 mt-0.5" />
                      <span className="text-[#e7e9ea]/90 leading-snug">{ arg }</span>
                    </li>
                  )) }
                </ul>
              </div>
            ) }

            { (analysisResult.keypoints?.key_statistics?.facts?.length > 0 || analysisResult.keypoints?.key_statistics?.questions?.length > 0) && (
              <div className="pt-3 border-t border-[rgb(47,51,54)]">
                { analysisResult.keypoints?.key_statistics?.facts?.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2 block">Key Facts</span>
                    <ul className="space-y-1.5 m-0 p-0 list-disc list-inside pl-4 text-[13px] text-[#e7e9ea]/80">
                      { analysisResult.keypoints.key_statistics.facts.map((fact, i) => (
                        <li key={ i }>{ fact }</li>
                      )) }
                    </ul>
                  </div>
                ) }
                { analysisResult.keypoints?.key_statistics?.questions?.length > 0 && (
                  <div>
                    <span className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2 block">Raised Questions</span>
                    <ul className="space-y-1.5 m-0 p-0 list-disc list-inside pl-4 text-[13px] text-[#e7e9ea]/80">
                      { analysisResult.keypoints.key_statistics.questions.map((q, i) => (
                        <li key={ i }>{ q }</li>
                      )) }
                    </ul>
                  </div>
                ) }
              </div>
            ) }
          </div>
        </div>
      ) }

      { !analysisLoading && !analysisResult && !analysisError && currentTweetId && (
        <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-3">
          <FileText className="w-12 h-12 text-[#71767b]/50" />
          <span>Click "Analyze Post" to generate an AI summary, extract keypoints, and analyze sentiment.</span>
        </div>
      ) }
    </div>
  );
};

export default AnalysisTab;