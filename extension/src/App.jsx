import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, CircleCheck, CircleAlert, Settings, Key, FileText, LayoutList } from 'lucide-react';
import FeedTab from './FeedTab';
import AnalysisTab from './AnalysisTab';

const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTopic, setActiveTopic] = useState('All');
  const [agentStatus, setAgentStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // New states for Post Analysis
  const [currentTweetId, setCurrentTweetId] = useState(null);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'analysis'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState('');

  // Use a ref to keep track of the current tweet ID for callbacks
  const currentTweetIdRef = useRef(currentTweetId);

  // Utility function to safely check if extension is still valid
  const isExtensionValid = () => {
    try {
      return !!chrome.runtime?.id;
    } catch (e) {
      return false;
    }
  };

  // Poll server status
  useEffect(() => {
    const checkServer = () => {
      if (!isExtensionValid()) return;
      try {
        chrome.runtime.sendMessage({ action: 'check_server' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response && response.online) {
            setServerOnline(true);
          } else {
            setServerOnline(false);
          }
        });
      } catch (e) { }
    };

    checkServer();
    const intervalId = setInterval(checkServer, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Track current URL for single tweet page
  useEffect(() => {
    const checkUrl = () => {
      const match = window.location.pathname.match(/\/(.+)\/status\/(\d+)/);
      if (match) {
        const newTweetId = match[2];
        if (newTweetId !== currentTweetId) {
          setCurrentTweetId(newTweetId);
          // Automatically switch to analysis tab when opening a single tweet page
          setActiveTab('analysis');
          setAnalysisResult(null);
          setAnalysisError(null);
        }
      } else {
        if (currentTweetId !== null) {
          setCurrentTweetId(null);
          // Optional: switch back to feed when leaving tweet page
          setActiveTab('feed');
          setAnalysisResult(null);
          setAnalysisError(null);
        }
      }
    };
    checkUrl();
    const interval = setInterval(checkUrl, 1000);
    return () => clearInterval(interval);
  }, [currentTweetId]);

  // Keep ref up to date
  useEffect(() => {
    currentTweetIdRef.current = currentTweetId;

    // Check cache when tweet ID changes
    if (currentTweetId && isExtensionValid()) {
      try {
        const cacheKey = `post_analysis_${currentTweetId}`;
        chrome.storage.local.get([cacheKey], (result) => {
          if (chrome.runtime.lastError) return;
          if (result[cacheKey]) {
            setAnalysisResult(result[cacheKey]);
          }
        });
      } catch (e) { }
    }
  }, [currentTweetId]);

  // Listen for SSE messages from background script
  useEffect(() => {
    if (!isExtensionValid()) return;

    const handleMessage = (message) => {
      if (message.type === 'AGENT_STATUS') {
        setAgentStatus(message.status);
      } else if (message.type === 'AGENT_DONE') {
        setLoading(false);
        setAgentStatus('');
        if (message.data && message.data.recommendations) {
          setRecommendations(message.data.recommendations);
          setUserProfile(message.data.user_profile);

          const now = Date.now();
          setLastUpdated(now);

          try {
            if (isExtensionValid()) {
              chrome.storage.local.set({
                savedRecommendations: message.data.recommendations,
                savedUserProfile: message.data.user_profile,
                lastUpdatedTime: now
              });
            }
          } catch (e) { }
        }
      } else if (message.type === 'AGENT_ERROR') {
        setLoading(false);
        setAgentStatus('');
        setError(message.error === 'Failed to fetch' ? 'Server not running' : message.error);
      } else if (message.type === 'ANALYZE_STATUS') {
        setAnalysisStatus(message.status);
      } else if (message.type === 'ANALYZE_DONE') {
        setAnalysisLoading(false);
        setAnalysisStatus('');
        setAnalysisResult(message.data);

        // Save to cache
        const id = currentTweetIdRef.current;
        if (id && isExtensionValid()) {
          try {
            chrome.storage.local.set({
              [`post_analysis_${id}`]: message.data
            });
          } catch (e) { }
        }
      } else if (message.type === 'ANALYZE_ERROR') {
        setAnalysisLoading(false);
        setAnalysisStatus('');
        setAnalysisError(message.error === 'Failed to fetch' ? 'Server not running' : message.error);
      }
    };

    try {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => {
        try {
          if (isExtensionValid()) {
            chrome.runtime.onMessage.removeListener(handleMessage);
          }
        } catch (e) { }
      };
    } catch (e) { }
  }, []);

  // Load saved recommendations and settings from storage on mount
  useEffect(() => {
    try {
      if (isExtensionValid()) {
        chrome.storage.local.get(['savedRecommendations', 'savedUserProfile', 'lastUpdatedTime', 'googleApiKey'], (result) => {
          if (chrome.runtime.lastError) return;
          if (result.savedRecommendations) setRecommendations(result.savedRecommendations);
          if (result.savedUserProfile) setUserProfile(result.savedUserProfile);
          if (result.lastUpdatedTime) setLastUpdated(result.lastUpdatedTime);
          if (result.googleApiKey) {
            setGoogleApiKey(result.googleApiKey);
          } else {
            setShowSettings(true);
          }
        });
      }
    } catch (e) { }
  }, []);

  const saveApiKey = (key) => {
    setGoogleApiKey(key);
    try {
      if (isExtensionValid()) {
        chrome.storage.local.set({ googleApiKey: key });
      }
    } catch (e) { }
    if (key) setShowSettings(false);
  };

  const fetchRecommendations = () => {
    if (!googleApiKey) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setError(null);
    setAgentStatus('Starting agent...');
    try {
      if (isExtensionValid()) {
        chrome.runtime.sendMessage({
          action: 'fetch_recommendations',
          googleApiKey: googleApiKey
        });
      } else {
        setError('Extension updated. Please refresh the page (F5) to use the new version.');
        setLoading(false);
      }
    } catch (e) {
      setError('Extension updated. Please refresh the page (F5) to use the new version.');
      setLoading(false);
    }
  };

  const analyzePost = () => {
    if (!googleApiKey) {
      setShowSettings(true);
      return;
    }
    if (!currentTweetId) return;

    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setAnalysisStatus('Starting analysis...');

    try {
      if (isExtensionValid()) {
        chrome.runtime.sendMessage({
          action: 'analyze_post',
          googleApiKey: googleApiKey,
          tweetId: currentTweetId
        });
      } else {
        setAnalysisError('Extension updated. Please refresh the page (F5).');
        setAnalysisLoading(false);
      }
    } catch (e) {
      setAnalysisError('Extension updated. Please refresh the page (F5).');
      setAnalysisLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={ () => setIsSidebarOpen(true) }
        className="fixed top-0 right-0 z-[2147483647] bg-[#1d9bf0] text-white p-2 m-4 rounded-full shadow-[0_4px_16px_rgba(29,155,240,0.5)] hover:bg-[#1a8cd8] hover:scale-105 transition-all duration-200 flex items-center justify-center group cursor-pointer border-none"
        title="Open Twitter Agent"
      >
        <Bot className="w-7 h-7" />
        <span className="absolute right-0 mr-3 bg-[rgba(0,0,0,0.8)] text-white text-sm px-3 py-1.5 rounded-md font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Agent
        </span>
      </button>

      { isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[2147483646] backdrop-blur-sm transition-opacity"
          onClick={ () => setIsSidebarOpen(false) }
        />
      ) }

      {/* User Persona Profile (only show if feed tab is active or not full screen modal) */ }
      { isSidebarOpen && activeTab === 'feed' && (
        <div className="fixed top-full left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-4 z-[2147483647]">
          {/* Status Panel */ }
          <div className="w-[640px] bg-[#000000] border border-[rgb(47,51,54)] rounded-2xl p-5 shadow-2xl">
            <h3 className="text-[#e7e9ea] font-bold text-md mb-3 m-0">System Status</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[#71767b] text-sm flex items-center gap-2">Server: { serverOnline ? <span className="text-[#00ba7c] flex items-center gap-2"><CircleCheck className="w-4 h-4 text-[#00ba7c]" /> Online</span> : <span className="text-[#f4212e] flex items-center gap-2"><CircleAlert className="w-4 h-4 text-[#f4212e]" /> Offline</span> }</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#71767b] text-sm">
                  { loading
                    ? `Agent: ${agentStatus || 'Running...'}`
                    : `Last Update: ${lastUpdated ? new Date(lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* User Persona Panel */ }
          { userProfile && (
            <div className="w-[640px] bg-[#000000] border border-[rgb(47,51,54)] rounded-2xl p-6 shadow-2xl">
              <h3 className="text-[#1d9bf0] font-bold text-lg mb-5 flex items-center gap-2 m-0">
                <Bot className="w-5 h-5" /> User Persona
              </h3>
              <div className="mb-5">
                <h4 className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2.5 m-0">Interests</h4>
                <div className="flex flex-wrap gap-2">
                  { userProfile.interests?.map((interest, i) => (
                    <span key={ i } className="bg-[rgba(29,155,240,0.1)] text-[#1d9bf0] text-xs px-2.5 py-1.5 rounded-md border border-[#1d9bf0]/20">
                      { interest }
                    </span>
                  )) }
                </div>
              </div>
              <div className="mb-5">
                <h4 className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2.5 m-0">Preferred Topics</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={ () => setActiveTopic('All') }
                    className={ `text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${activeTopic === 'All' ? 'bg-[#1d9bf0] text-white border-[#1d9bf0]' : 'bg-[rgba(255,255,255,0.05)] text-[#e7e9ea] border-[rgb(47,51,54)] hover:bg-[rgba(255,255,255,0.1)]'}` }
                  >
                    All
                  </button>
                  { userProfile.preferred_topics?.map((topic, i) => (
                    <button
                      key={ i }
                      onClick={ () => setActiveTopic(topic) }
                      className={ `text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${activeTopic === topic ? 'bg-[#1d9bf0] text-white border-[#1d9bf0]' : 'bg-[rgba(255,255,255,0.05)] text-[#e7e9ea] border-[rgb(47,51,54)] hover:bg-[rgba(255,255,255,0.1)]'}` }
                    >
                      { topic }
                    </button>
                  )) }
                </div>
              </div>
              <div>
                <h4 className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2.5 m-0">Tone</h4>
                <p className="text-[#e7e9ea] text-sm m-0 leading-relaxed italic">
                  "{ userProfile.tone }"
                </p>
              </div>
            </div>
          ) }
        </div>
      ) }

      {/* Sliding Sidebar */ }
      <div
        className={ `fixed top-0 right-0 h-screen w-[420px] bg-[#000000] border-l border-[rgb(47,51,54)] z-[2147483647] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}` }
      >
        <div className="flex flex-col h-full">
          {/* Header */ }
          <div className="sticky top-0 bg-[rgba(0,0,0,0.85)] backdrop-blur-md border-b border-[rgb(47,51,54)] p-4 flex justify-between items-center z-10 shrink-0">
            <h2 className="text-[#e7e9ea] font-bold text-xl flex items-center gap-2 m-0">
              <Bot className="w-6 h-6 text-[#1d9bf0]" />
              Agent
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={ () => setShowSettings(!showSettings) }
                className={ `text-[#71767b] hover:text-[#e7e9ea] hover:bg-[rgba(255,255,255,0.1)] p-2 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center ${showSettings ? 'text-[#1d9bf0] bg-[rgba(29,155,240,0.1)]' : ''}` }
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={ () => setIsSidebarOpen(false) }
                className="text-[#71767b] hover:text-[#e7e9ea] hover:bg-[rgba(255,255,255,0.1)] p-2 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings Panel */ }
          { showSettings && (
            <div className="px-4 py-4 border-b border-[rgb(47,51,54)] bg-[rgba(29,155,240,0.02)] shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[#1d9bf0]">
                  <Key className="w-4 h-4" />
                  <span className="font-bold text-[14px]">Google API Key</span>
                </div>
                <p className="text-[13px] text-[#71767b] m-0">
                  Required to run the Gemini agent. Your key is stored securely.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={ googleApiKey }
                    onChange={ (e) => setGoogleApiKey(e.target.value) }
                    className="flex-1 bg-black border border-[rgb(47,51,54)] rounded-md px-3 py-2 text-[14px] text-[#e7e9ea] focus:outline-none focus:border-[#1d9bf0]"
                  />
                  <button
                    onClick={ () => saveApiKey(googleApiKey) }
                    className="bg-[#e7e9ea] hover:bg-[#d7dbdc] text-black px-4 py-2 rounded-md font-bold text-[14px] transition-colors border-none cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) }

          {/* Tabs */ }
          <div className="flex border-b border-[rgb(47,51,54)] shrink-0 bg-black">
            <button
              onClick={ () => setActiveTab('feed') }
              className={ `flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors border-none cursor-pointer ${activeTab === 'feed' ? 'text-[#e7e9ea] border-b-2 border-[#1d9bf0] bg-[rgba(29,155,240,0.1)]' : 'text-[#71767b] bg-transparent hover:bg-[rgba(255,255,255,0.05)]'}` }
            >
              <LayoutList className="w-4 h-4" /> Recommended Feed
            </button>
            <button
              onClick={ () => setActiveTab('analysis') }
              disabled={ !currentTweetId && !analysisResult }
              className={ `flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors border-none ${(!currentTweetId && !analysisResult) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${activeTab === 'analysis' ? 'text-[#e7e9ea] border-b-2 border-[#1d9bf0] bg-[rgba(29,155,240,0.1)]' : 'text-[#71767b] bg-transparent hover:bg-[rgba(255,255,255,0.05)]'}` }
              title={ !currentTweetId && !analysisResult ? 'Open a tweet to analyze it' : 'Analyze Current Post' }
            >
              <FileText className="w-4 h-4" /> Post Analysis
            </button>
          </div>

          {/* Content Area */ }
          <div className="flex-1 overflow-y-auto">
            { activeTab === 'feed' && (
              <FeedTab
                fetchRecommendations={fetchRecommendations}
                loading={loading}
                error={error}
                recommendations={recommendations}
                activeTopic={activeTopic}
                agentStatus={agentStatus}
              />
            ) }

            { activeTab === 'analysis' && (
              <AnalysisTab
                currentTweetId={currentTweetId}
                analysisResult={analysisResult}
                analysisLoading={analysisLoading}
                analysisError={analysisError}
                analysisStatus={analysisStatus}
                analyzePost={analyzePost}
              />
            ) }
          </div>
        </div>
      </div>
    </>
  );
};

export default App;