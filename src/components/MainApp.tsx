import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || ""
});
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Music, Activity, Play, Pause, Download, 
  RefreshCw, CheckCircle2, Clock, Volume2, Sparkles,
  ChevronRight, Share2, ArrowRight,
  ShieldCheck, Lock, EyeOff, Globe, Smile, Zap, Film, Wand2, LogOut,
  Headphones, Disc3, AudioLines, Mic2, ListMusic, Radio, Gauge, Clapperboard, MonitorPlay, FastForward, Rewind, Cpu,
  Music2, Music3, Music4, AudioWaveform, MessageSquare, Copy
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { extractFrames, extractHighlights } from '../utils/videoUtils';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

type GenerationState = 'idle' | 'analyzing' | 'extracting_highlights' | 'generating' | 'complete' | 'error';

const MOODS = ['Cinematic', 'Happy', 'Suspense', 'Emotional', 'Energetic', 'Lo-Fi', 'Ambient'];
const TEMPOS = ['Slow (60-80 BPM)', 'Medium (90-110 BPM)', 'Fast (120+ BPM)'];
const INDIAN_LANGUAGES = ['Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu', 'Gujarati', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese'];
const CAPTION_LANGUAGES = ['Hinglish', 'English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Punjabi'];

const THEME_COLORS = [
  { from: 'from-violet-500', to: 'to-fuchsia-500', bg: 'bg-violet-500', text: 'text-violet-600', border: 'border-violet-200', shadow: 'shadow-violet-500/30', lightBg: 'bg-violet-50' },
  { from: 'from-blue-500', to: 'to-cyan-500', bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', shadow: 'shadow-blue-500/30', lightBg: 'bg-blue-50' },
  { from: 'from-emerald-500', to: 'to-teal-500', bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200', shadow: 'shadow-emerald-500/30', lightBg: 'bg-emerald-50' },
  { from: 'from-rose-500', to: 'to-orange-500', bg: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-200', shadow: 'shadow-rose-500/30', lightBg: 'bg-rose-50' },
  { from: 'from-indigo-500', to: 'to-purple-500', bg: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-200', shadow: 'shadow-indigo-500/30', lightBg: 'bg-indigo-50' },
];

const FloatingNotes = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    {[...Array(12)].map((_, i) => {
      const Icon = [Music, Music2, Music3, Music4][i % 4];
      const left = `${Math.random() * 100}%`;
      const animationDuration = `${Math.random() * 4 + 4}s`;
      const animationDelay = `${Math.random() * 5}s`;
      const size = Math.random() * 16 + 16;
      const opacity = Math.random() * 0.3 + 0.1;
      
      return (
        <div 
          key={i} 
          className="absolute bottom-[-50px] animate-float-note"
          style={{ 
            left, 
            animationDuration, 
            animationDelay,
            opacity
          }}
        >
          <Icon size={size} className="text-slate-400" />
        </div>
      );
    })}
  </div>
);

export default function MainApp({ onLogout }: { onLogout: () => void }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [mood, setMood] = useState(MOODS[0]);
  const [tempo, setTempo] = useState(TEMPOS[1]);
  
  const [situation, setSituation] = useState('');
  const [language, setLanguage] = useState(INDIAN_LANGUAGES[0]);
  
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [generatedTracks, setGeneratedTracks] = useState<any[]>([]);
  const [activeTrack, setActiveTrack] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportingTrack, setExportingTrack] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [generationMode, setGenerationMode] = useState<'custom' | 'existing' | null>(null);
  const [targetDuration, setTargetDuration] = useState<number>(15);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgressMsg, setExtractProgressMsg] = useState('');
  const [originalVideoFile, setOriginalVideoFile] = useState<File | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  
  const [captionLanguage, setCaptionLanguage] = useState(CAPTION_LANGUAGES[0]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [wantsCaptions, setWantsCaptions] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 0;
      videoRef.current.muted = true;
    }
  }, [videoUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener('timeupdate', updateProgress);
    return () => audio.removeEventListener('timeupdate', updateProgress);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (genState === 'analyzing' || genState === 'extracting_highlights' || genState === 'generating') {
      setLoadingPercentage(0);
      interval = setInterval(() => {
        setLoadingPercentage(prev => {
          if (prev >= 99) return 99;
          const increment = Math.random() * (99 - prev) * 0.1 + 1;
          return Math.min(99, prev + increment);
        });
      }, 500);
    } else if (genState === 'complete') {
      setLoadingPercentage(100);
    } else {
      setLoadingPercentage(0);
    }
    return () => clearInterval(interval);
  }, [genState]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setOriginalVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setGenState('idle');
      setGeneratedTracks([]);
      setAnalysisResult(null);
    }
  };

  const handleExtractHighlights = async () => {
    if (!originalVideoFile) return;
    setIsExtracting(true);
    setExtractProgressMsg('Initializing...');
    try {
      const shortVideo = await extractHighlights(originalVideoFile, targetDuration, setExtractProgressMsg);
      setVideoFile(shortVideo);
      setVideoUrl(URL.createObjectURL(shortVideo));
    } catch (error) {
      console.error(error);
    } finally {
      setIsExtracting(false);
      setExtractProgressMsg('');
    }
  };

  const handleGenerate = async (mode: 'custom' | 'existing') => {
    setGenerationMode(mode);
    setGenState('analyzing');
    
    try {
      const frames = videoFile ? await extractFrames(videoFile) : [];
      
      let prompt = '';
      const captionPromptAddition = wantsCaptions ? `\n\nAdditionally, generate 3 highly engaging, trendy, and aesthetic social media captions for Instagram Reels/YouTube Shorts in ${captionLanguage}. Use strong hooks, relatable aesthetic phrasing, emojis, and trending hashtags to maximize algorithm reach and views.` : '';
      const captionJsonAddition = wantsCaptions ? `,\n          "viralCaptions": [\n            "Caption 1 with aesthetic hook and #hashtags",\n            "Caption 2 with aesthetic hook and #hashtags",\n            "Caption 3 with aesthetic hook and #hashtags"\n          ]` : '';

      if (mode === 'existing') {
        prompt = `Act as an expert Indian music supervisor and video analyst. I am providing you with frames extracted from a video. Analyze what is happening in the video visually.
        
        The user has also provided the following preferences and optional context/correction:
        Mood: ${mood}
        Tempo: ${tempo}
        User's Situation/Context: ${situation || 'Not provided'}
        Language: ${language}
        
        Based on your visual analysis of the video AND the user's context, recommend 6 actual, popular existing songs in the selected language that perfectly fit this video.${captionPromptAddition}
        
        Return ONLY a valid JSON object with this exact structure:
        {
          "detectedScenes": 3,
          "dominantEmotion": "Romantic",
          "energyCurve": "Steady and emotional",
          "visualAnalysisSummary": "Brief summary of what you see in the video and how the user's prompt influenced the choice",
          "recommendedSongs": [
            {
              "title": "Song Name",
              "movie": "Movie/Album Name",
              "singer": "Singer Name",
              "reason": "Why this song fits the video and user prompt perfectly",
              "matchPercentage": 95
            }
          ]${captionJsonAddition}
        }`;
      } else {
        prompt = `Act as an expert music composer and video analyst. I am providing you with frames extracted from a video. Analyze what is happening in the video visually.
        
        The user has also provided the following preferences and optional context/correction:
        Mood: ${mood}
        Tempo: ${tempo}
        User's Situation/Context: ${situation || 'Not provided'}
        Language/Cultural Vibe: ${language}
        
        Based on your visual analysis of the video AND the user's context, determine the cultural feel of the video. Then, GENERATE 3 original music track concepts that perfectly fit the video's moments, mood, and cultural feel.${captionPromptAddition}
        
        Return ONLY a valid JSON object with this exact structure:
        {
          "detectedScenes": 3,
          "dominantEmotion": "Romantic",
          "energyCurve": "Steady and emotional",
          "visualAnalysisSummary": "Brief summary of what you see in the video and how the cultural feel was determined",
          "recommendedSongs": [
            {
              "title": "A short 2-3 word genre description",
              "searchQuery": "A highly effective Apple Music search query to find a matching instrumental/BGM track",
              "movie": "Custom AI Generation",
              "singer": "Instrumental",
              "reason": "Explain how it matches the cultural feel and the video's mood.",
              "matchPercentage": 98
            }
          ]${captionJsonAddition}
        }`;
      }

      const parts: any[] = frames.map(frame => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: frame
        }
      }));
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      const analysis = JSON.parse(response.text || '{}');
      setAnalysisResult(analysis);
      if (analysis.viralCaptions && Array.isArray(analysis.viralCaptions)) {
        setCaptions(analysis.viralCaptions);
      } else {
        setCaptions([]);
      }
      
      setGenState('generating');

      const tracks = await Promise.all((analysis.recommendedSongs || []).map(async (song: any, idx: number) => {
        let mp3Url = '';
        if (mode === 'existing') {
          try {
            const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(song.title + ' ' + song.singer)}&entity=song&limit=1`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              mp3Url = data.results[0].previewUrl;
            }
          } catch (e) {
            console.error('Failed to fetch MP3', e);
          }
        } else {
          try {
            const searchQuery = encodeURIComponent(song.searchQuery || (song.title + ' instrumental'));
            const res = await fetch(`https://itunes.apple.com/search?term=${searchQuery}&entity=song&limit=5`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              const randomIdx = Math.floor(Math.random() * Math.min(3, data.results.length));
              mp3Url = data.results[randomIdx].previewUrl;
            } else {
              const fallbackQuery = encodeURIComponent(song.title.split(' ')[0] + ' music');
              const fallbackRes = await fetch(`https://itunes.apple.com/search?term=${fallbackQuery}&entity=song&limit=1`);
              const fallbackData = await fallbackRes.json();
              if (fallbackData.results && fallbackData.results.length > 0) {
                mp3Url = fallbackData.results[0].previewUrl;
              } else {
                mp3Url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
              }
            }
          } catch (e) {
            console.error('Failed to fetch custom MP3 simulation', e);
            mp3Url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
          }
        }

        return {
          id: idx + 1,
          name: song.title,
          movie: song.movie,
          singer: song.singer,
          reason: song.reason,
          matchPercentage: song.matchPercentage || Math.floor(Math.random() * 20) + 80,
          url: mp3Url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          bestStartTime: 0,
          otherParts: [
            { label: 'Intro', startTime: 0 },
            { label: 'Drop', startTime: 10 },
            { label: 'Climax', startTime: 20 }
          ]
        };
      }));
      
      setGeneratedTracks(tracks);
      
      setGenState('complete');
      setActiveTrack(0);
      setIsPlaying(false);
      setTimeout(() => {
        if (audioRef.current && tracks.length > 0) {
          audioRef.current.src = tracks[0].url;
        }
      }, 50);
      
    } catch (error) {
      console.error(error);
      setGenState('error');
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    if (isPlaying) {
      if (video) video.pause();
      if (audio) audio.pause();
      setIsPlaying(false);
    } else {
      if (video) video.play();
      if (audio) audio.play();
      setIsPlaying(true);
    }
  };

  const handleExport = async (idx: number) => {
    if (!videoFile || !generatedTracks[idx]) return;
    
    setExportingTrack(idx);
    setExportProgress(0);
    
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        setExportProgress(Math.round(progress * 100));
      });
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
      
      const audioUrl = generatedTracks[idx].url;
      await ffmpeg.writeFile('audio.mp3', await fetchFile(audioUrl));
      
      const args = ['-i', 'input.mp4'];
      
      args.push(
        '-i', 'audio.mp3',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        'output.mp4'
      );
      
      await ffmpeg.exec(args);
      
      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_video.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export video. Please try again.');
    } finally {
      setExportingTrack(null);
      setExportProgress(0);
    }
  };

  const handleGenerateCaptions = async () => {
    if (!analysisResult) return;
    setIsGeneratingCaptions(true);
    try {
      const prompt = `Based on the following video analysis, generate 3 highly engaging, trendy, and aesthetic social media captions (for Instagram Reels/YouTube Shorts) in ${captionLanguage} language. Use strong hooks, relatable aesthetic phrasing, emojis, and trending hashtags to maximize algorithm reach and views.
      
      Video Analysis:
      - Scenes: ${analysisResult.detectedScenes}
      - Emotion: ${analysisResult.dominantEmotion}
      - Energy: ${analysisResult.energyCurve}
      - Summary: ${analysisResult.visualAnalysisSummary}
      
      Return ONLY a valid JSON array of strings. Example: ["Caption 1", "Caption 2", "Caption 3"]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      const generatedCaptions = JSON.parse(response.text || '[]');
      setCaptions(generatedCaptions);
    } catch (error) {
      console.error('Failed to generate captions', error);
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  const handleTrackPlay = (idx: number, seekToTime?: number) => {
    const targetTime = seekToTime !== undefined ? seekToTime : generatedTracks[idx].bestStartTime;
    
    if (activeTrack === idx) {
      if (seekToTime !== undefined) {
        if (audioRef.current) audioRef.current.currentTime = targetTime;
        if (!isPlaying) togglePlay();
      } else {
        togglePlay();
      }
    } else {
      setActiveTrack(idx);
      setIsPlaying(true);
      
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = generatedTracks[idx].url;
          audioRef.current.currentTime = targetTime;
          audioRef.current.play();
        }
        if (videoRef.current) {
          videoRef.current.play();
        }
      }, 50);
    }
  };

  const activeTheme = activeTrack !== null ? THEME_COLORS[activeTrack % THEME_COLORS.length] : THEME_COLORS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 selection:bg-violet-200 pb-24 relative overflow-hidden">
      {isPlaying && <FloatingNotes />}
      <audio 
        ref={audioRef} 
        onEnded={() => {
          setIsPlaying(false);
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }}
      />

      <header className="border-b border-white/50 bg-white/60 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 blur-lg opacity-20 rounded-full group-hover:opacity-40 transition-opacity" />
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 relative z-10 border border-white/20">
                <Headphones className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Vibe<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Sync</span></h1>
            </div>
          </div>
          
          <nav className="flex items-center gap-3">
            {isPreviewMode && (
              <button
                onClick={() => {
                  setIsPreviewMode(false);
                  if (audioRef.current) audioRef.current.pause();
                  setIsPlaying(false);
                }}
                className="px-4 py-2 rounded-full text-sm font-bold bg-white text-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all flex items-center gap-2 border border-slate-100"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Studio
              </button>
            )}
            <button
              onClick={onLogout}
              className="p-2.5 rounded-full text-slate-400 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all border border-transparent hover:border-slate-200"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 transition-colors duration-1000">
          <div className={`absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full ${activeTheme.bg}/20 blur-[120px] mix-blend-multiply animate-blob transition-colors duration-1000`} />
          <div className={`absolute top-[40%] right-[10%] w-[30vw] h-[30vw] rounded-full ${activeTheme.bg}/20 blur-[120px] mix-blend-multiply animate-blob animation-delay-2000 transition-colors duration-1000`} />
        </div>

        <AnimatePresence mode="wait">
          {isPreviewMode && activeTrack !== null && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 relative z-10"
            >
              <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
                <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video shadow-inner group">
                  <video 
                    ref={videoRef}
                    src={videoUrl || ''} 
                    className="w-full h-full object-cover"
                    playsInline
                    onEnded={() => {
                      setIsPlaying(false);
                      if (audioRef.current) {
                        audioRef.current.pause();
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-10">
                    <div className="flex items-end justify-between translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      <div>
                        <h2 className="text-4xl font-extrabold text-white mb-3 tracking-tight">{generatedTracks[activeTrack].name}</h2>
                        <div className="flex items-center gap-4 text-sm text-white/80 font-medium">
                          <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10"><Mic2 className="w-4 h-4 text-violet-400" /> {generatedTracks[activeTrack].singer}</span>
                          <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10"><Disc3 className="w-4 h-4 text-fuchsia-400" /> {generatedTracks[activeTrack].movie}</span>
                        </div>
                      </div>
                      <button 
                        onClick={togglePlay}
                        className="w-20 h-20 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl"
                      >
                        {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => handleExport(activeTrack)}
                  disabled={exportingTrack !== null}
                  className="group px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all duration-300 ease-out flex items-center gap-3 text-lg shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95 active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-xl"
                >
                  {exportingTrack === activeTrack ? (
                    <>
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      Exporting {exportProgress}%
                    </>
                  ) : (
                    <>
                      <Download className="w-6 h-6 transition-transform group-hover:-translate-y-1" />
                      Download Master
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'My VibeSync Video',
                        text: `Check out this video with the song ${generatedTracks[activeTrack].name}!`,
                        url: window.location.href,
                      }).catch(console.error);
                    } else {
                      alert('Sharing is not supported on this browser.');
                    }
                  }}
                  className="group px-8 py-4 bg-white text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all duration-300 ease-out flex items-center gap-3 text-lg border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 active:scale-95 active:translate-y-0"
                >
                  <Share2 className="w-6 h-6 transition-transform group-hover:scale-110 group-hover:rotate-12" />
                  Share
                </button>
              </div>
            </motion.div>
          )}

          {!isPreviewMode && (
            <motion.div
              key="composer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full relative z-10"
            >
              {/* Left Panel: Studio Controls */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                      <MonitorPlay className="w-4 h-4 text-violet-600" />
                    </div>
                    <h2 className="text-base font-bold text-slate-800">Visual Input</h2>
                  </div>
                  
                  {!videoUrl ? (
                    <label className="border-2 border-dashed border-violet-200 bg-violet-50/50 rounded-[1.5rem] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-violet-50 hover:border-violet-400 transition-all duration-300 group relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                        <Upload className="w-8 h-8 text-violet-500" />
                      </div>
                      <div className="text-center relative z-10">
                        <p className="text-lg font-bold text-slate-700 mb-1">Drop video here</p>
                        <p className="text-sm font-medium text-slate-500">MP4, MOV up to 500MB</p>
                      </div>
                      <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  ) : (
                    <div className="relative rounded-[1.5rem] overflow-hidden bg-black aspect-video group shadow-inner">
                      <video 
                        ref={!isPreviewMode ? videoRef : undefined}
                        src={videoUrl} 
                        className="w-full h-full object-cover"
                        playsInline
                        onEnded={() => {
                          setIsPlaying(false);
                          if (audioRef.current) {
                            audioRef.current.pause();
                          }
                        }}
                      />
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button 
                          onClick={() => {
                            setVideoUrl(null);
                            setVideoFile(null);
                            setGenState('idle');
                            setGeneratedTracks([]);
                            setAnalysisResult(null);
                            setActiveTrack(null);
                            setIsPlaying(false);
                            if (audioRef.current) {
                              audioRef.current.pause();
                              audioRef.current.src = '';
                            }
                          }}
                          className="p-2.5 bg-white/90 hover:bg-red-50 text-red-500 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg hover:scale-110 active:scale-95"
                          title="Remove Video"
                        >
                          <RefreshCw className="w-4 h-4 rotate-45" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-2 text-slate-700 mb-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-wider">Studio Privacy</span>
                    </div>
                    <ul className="text-xs font-medium text-slate-500 space-y-2">
                      <li className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-slate-400" /> End-to-End Encrypted</li>
                      <li className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5 text-slate-400" /> Local AI Processing</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <AudioLines className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h2 className="text-base font-bold text-slate-800">Audio Direction</h2>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vibe / Prompt</label>
                      <div className="relative group">
                        <Mic2 className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <textarea 
                          value={situation}
                          onChange={(e) => setSituation(e.target.value)}
                          placeholder="E.g., Hero ki entry ho rahi hai slow motion mein..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-indigo-300 hover:bg-white min-h-[100px] resize-none transition-all duration-300"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mood</label>
                        <div className="relative group">
                          <Smile className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                          <select 
                            value={mood}
                            onChange={(e) => setMood(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-indigo-300 hover:bg-white cursor-pointer appearance-none transition-all duration-300"
                          >
                            {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tempo</label>
                        <div className="relative group">
                          <Gauge className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                          <select 
                            value={tempo}
                            onChange={(e) => setTempo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-indigo-300 hover:bg-white cursor-pointer appearance-none transition-all duration-300"
                          >
                            {TEMPOS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-8">
                    <button
                      onClick={() => handleGenerate('custom')}
                      disabled={genState === 'analyzing' || genState === 'generating' || genState === 'extracting_highlights'}
                      className="group w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold py-4 rounded-2xl transition-all duration-300 ease-out flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-violet-500/25 hover:shadow-2xl hover:shadow-violet-500/40 hover:-translate-y-1 active:scale-95 active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-xl"
                    >
                      {genState === 'analyzing' || genState === 'generating' || genState === 'extracting_highlights' ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Headphones className="w-5 h-5 transition-transform group-hover:scale-110" />
                      )}
                      {genState === 'extracting_highlights' ? 'Extracting Highlights...' :
                       genState === 'analyzing' ? 'Analyzing Video...' : 
                       genState === 'generating' ? 'Generating Custom Music...' : 
                       'Generate Music'}
                    </button>
                    
                    <button
                      onClick={() => handleGenerate('existing')}
                      disabled={genState === 'analyzing' || genState === 'generating' || genState === 'extracting_highlights'}
                      className="group w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl transition-all duration-300 ease-out flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 active:scale-95 active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                    >
                      {genState === 'analyzing' || genState === 'generating' || genState === 'extracting_highlights' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ListMusic className="w-4 h-4 transition-transform group-hover:scale-110" />
                      )}
                      {genState === 'extracting_highlights' ? 'Extracting Highlights...' :
                       genState === 'analyzing' ? 'Analyzing Video...' : 
                       genState === 'generating' ? 'Finding Perfect Songs...' : 
                       'Find Existing Tracks'}
                    </button>
                  </div>
                </div>

                {/* Viral Captions Section */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-rose-600" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-800">Viral Captions</h2>
                        <p className="text-xs text-slate-500 font-medium">Auto-generate aesthetic captions</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setWantsCaptions(!wantsCaptions)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${wantsCaptions ? 'bg-rose-500 shadow-lg shadow-rose-500/30' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${wantsCaptions ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {wantsCaptions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-5 mt-5 border-t border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Caption Language</label>
                          <div className="relative">
                            <select 
                              value={captionLanguage}
                              onChange={(e) => setCaptionLanguage(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-3 px-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent hover:border-rose-300 hover:bg-white cursor-pointer font-medium transition-all duration-300 text-sm"
                            >
                              {CAPTION_LANGUAGES.map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                              ))}
                            </select>
                            <ChevronRight className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Highlight Reel Section */}
                {videoUrl && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center">
                        <Clapperboard className="w-4 h-4 text-fuchsia-600" />
                      </div>
                      <h2 className="text-base font-bold text-slate-800">Highlight Reel</h2>
                    </div>
                    
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Duration</label>
                        <div className="relative group">
                          <Clock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-fuchsia-500 transition-colors" />
                          <select 
                            value={targetDuration}
                            onChange={(e) => setTargetDuration(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-fuchsia-500/10 focus:border-fuchsia-500 hover:border-fuchsia-300 hover:bg-white cursor-pointer appearance-none transition-all duration-300"
                            disabled={isExtracting}
                          >
                            <option value={15}>15 Seconds (Short Reel)</option>
                            <option value={30}>30 Seconds (Standard Reel)</option>
                            <option value={60}>60 Seconds (Long Reel)</option>
                          </select>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleExtractHighlights}
                        disabled={isExtracting || !originalVideoFile}
                        className="group w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl transition-all duration-300 ease-out flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-xl hover:-translate-y-1 active:scale-95 active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                      >
                        {isExtracting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>{extractProgressMsg || 'Extracting...'}</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                            <span>Extract Best Scenes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Music Library & Results */}
              <div className="lg:col-span-7 space-y-6">
                {genState === 'idle' && (
                  <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-slate-500 border border-slate-200/60 rounded-[2.5rem] p-12 bg-white/50 backdrop-blur-sm relative overflow-hidden group shadow-sm">
                    <div className="relative mb-10">
                      <div className="absolute inset-0 bg-violet-500/20 blur-[50px] rounded-full animate-pulse" />
                      <div className="relative flex gap-6 opacity-90">
                        <motion.div 
                          animate={{ y: [0, -10, 0], rotate: [-5, -5, -5] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                          className="w-24 h-24 rounded-[2rem] bg-white flex items-center justify-center border border-slate-100 shadow-2xl"
                        >
                          <Film className="w-10 h-10 text-slate-300" />
                        </motion.div>
                        <motion.div 
                          animate={{ y: [0, 10, 0], rotate: [5, 5, 5] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                          className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center border border-violet-100 shadow-2xl shadow-violet-500/10"
                        >
                          <Disc3 className="w-10 h-10 text-violet-500" />
                        </motion.div>
                      </div>
                    </div>
                    <h3 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight relative z-10">Your Studio Awaits</h3>
                    <p className="text-lg text-center text-slate-500 max-w-md leading-relaxed relative z-10 font-medium">
                      Upload a video to the deck. We'll compose completely original music or find the perfect existing tracks to match the vibe.
                    </p>
                  </div>
                )}

                {(genState === 'analyzing' || genState === 'generating' || genState === 'extracting_highlights' || genState === 'complete') && (
                  <div className="space-y-6">
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-blue-600" />
                          </div>
                          <h2 className="text-base font-bold text-slate-800">AI Analysis</h2>
                        </div>
                        {(genState === 'analyzing' || genState === 'extracting_highlights') && <span className="text-xs font-bold uppercase tracking-wider text-violet-600 animate-pulse bg-violet-50 px-3 py-1 rounded-full">Processing...</span>}
                        {(genState === 'generating' || genState === 'complete') && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      </div>
                      
                      {(genState === 'analyzing' || genState === 'extracting_highlights') ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-8">
                          <div className="relative flex items-center justify-center">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} className="absolute">
                              <Film className="w-24 h-24 text-violet-500 opacity-10" />
                            </motion.div>
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                              <MonitorPlay className="w-12 h-12 text-violet-600 relative z-10" />
                            </motion.div>
                            <div className="absolute -right-2 -top-2">
                               <motion.div animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 2, repeat: Infinity, delay: 0 }}><Sparkles className="w-6 h-6 text-fuchsia-500" /></motion.div>
                            </div>
                          </div>
                          <div className="w-full max-w-md space-y-3">
                            <div className="flex justify-between text-sm font-bold text-slate-600">
                              <span>{genState === 'extracting_highlights' ? 'Extracting best 15-second reel...' : 'Analyzing visual and emotional tone...'}</span>
                              <span className="text-violet-600">{Math.round(loadingPercentage)}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div 
                                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300 ease-out"
                                style={{ width: `${loadingPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : analysisResult ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative overflow-hidden group hover:border-violet-200 transition-colors">
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2"><Film className="w-3.5 h-3.5" /> Scenes</div>
                              <div className="text-3xl font-extrabold text-slate-800">{analysisResult.detectedScenes}</div>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative overflow-hidden group hover:border-fuchsia-200 transition-colors">
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2"><Smile className="w-3.5 h-3.5" /> Emotion</div>
                              <div className="text-xl font-bold text-slate-800 truncate">{analysisResult.dominantEmotion}</div>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 md:col-span-1 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Energy</div>
                              <div className="text-sm font-semibold text-slate-700 leading-snug">{analysisResult.energyCurve}</div>
                            </div>
                          </div>
                          
                          {analysisResult.visualAnalysisSummary && (
                            <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-5">
                              <div className="flex items-center gap-2 mb-3">
                                <Wand2 className="w-4 h-4 text-violet-600" />
                                <div className="text-xs text-violet-700 uppercase tracking-wider font-bold">AI Video Analysis</div>
                              </div>
                              <div className="text-sm text-slate-700 leading-relaxed font-medium">
                                {analysisResult.visualAnalysisSummary}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {(genState === 'generating' || genState === 'complete') && (
                      <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                              <Radio className="w-4 h-4 text-emerald-600" />
                            </div>
                            <h2 className="text-base font-bold text-slate-800">
                              {generationMode === 'custom' ? 'Generated Custom Tracks' : 'Recommended Library'}
                            </h2>
                          </div>
                          {genState === 'generating' && <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 animate-pulse bg-emerald-50 px-3 py-1 rounded-full">
                            {generationMode === 'custom' ? 'Composing...' : 'Curating...'}
                          </span>}
                        </div>

                        {genState === 'generating' ? (
                          <div className="py-12 flex flex-col items-center justify-center space-y-8">
                            <div className="relative flex items-center justify-center">
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute">
                                <Disc3 className="w-24 h-24 text-emerald-500 opacity-20" />
                              </motion.div>
                              <motion.div animate={{ y: [-5, 5, -5] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                                <Headphones className="w-12 h-12 text-emerald-600 relative z-10" />
                              </motion.div>
                              <div className="absolute -right-6 -top-2 flex gap-1">
                                 <motion.div animate={{ y: [0, -10, 0], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}><Music className="w-5 h-5 text-emerald-500" /></motion.div>
                                 <motion.div animate={{ y: [0, -15, 0], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}><Music2 className="w-6 h-6 text-teal-500" /></motion.div>
                              </div>
                            </div>
                            <div className="w-full max-w-md space-y-3">
                              <div className="flex justify-between text-sm font-bold text-slate-600">
                                <span>{generationMode === 'custom' ? 'Composing original tracks...' : 'Curating perfect tracks...'}</span>
                                <span className="text-emerald-600">{Math.round(loadingPercentage)}%</span>
                              </div>
                              <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out"
                                  style={{ width: `${loadingPercentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {generatedTracks.map((track, idx) => {
                              const trackTheme = THEME_COLORS[idx % THEME_COLORS.length];
                              return (
                              <div 
                                key={track.id}
                                onClick={() => setActiveTrack(idx)}
                                className={`group relative overflow-hidden flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-2xl border transition-all duration-300 ease-out cursor-pointer ${activeTrack === idx ? `bg-white ${trackTheme.border} shadow-[0_8px_30px_rgba(0,0,0,0.08)] scale-[1.01]` : 'bg-slate-50 border-slate-100 hover:border-slate-300 hover:bg-white hover:shadow-md hover:-translate-y-0.5 active:scale-95'}`}
                              >
                                {activeTrack === idx && (
                                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${trackTheme.from} ${trackTheme.to}`} />
                                )}
                                
                                <div className="relative shrink-0 w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center shadow-inner overflow-hidden border-2 border-white">
                                  {/* Vinyl Record Look */}
                                  <div className={`absolute inset-0 bg-slate-900 rounded-full flex items-center justify-center ${activeTrack === idx && isPlaying ? 'animate-spin-slow' : ''}`}>
                                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${trackTheme.from} ${trackTheme.to} border-2 border-slate-900 flex items-center justify-center`}>
                                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    </div>
                                    <div className="absolute inset-1 border border-white/10 rounded-full" />
                                    <div className="absolute inset-3 border border-white/10 rounded-full" />
                                  </div>
                                  
                                  {/* Play Overlay */}
                                  <button 
                                    className={`absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 ${activeTrack === idx ? 'opacity-100' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTrackPlay(idx);
                                    }}
                                  >
                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50 transform transition-transform duration-300 hover:scale-110 active:scale-95">
                                      {activeTrack === idx && isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                                    </div>
                                  </button>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="text-lg font-bold text-slate-900 flex items-center gap-3 truncate pr-4">
                                      {track.name} 
                                      <span className="shrink-0 text-xs text-slate-500 font-semibold px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">{track.movie}</span>
                                    </div>
                                    <div className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                                      track.matchPercentage >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                                      track.matchPercentage >= 75 ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                                      'bg-orange-50 text-orange-600 border-orange-200'
                                    }`}>
                                      <Zap className="w-3.5 h-3.5" /> {track.matchPercentage}%
                                    </div>
                                  </div>
                                  <div className="text-sm text-slate-500 mb-3 flex items-center gap-2 font-medium">
                                    <Mic2 className="w-4 h-4 text-slate-400" /> {track.singer}
                                    {activeTrack === idx && isPlaying && (
                                      <div className="ml-2 flex items-end gap-0.5 h-3">
                                        <div className={`eq-bar ${trackTheme.text}`} />
                                        <div className={`eq-bar ${trackTheme.text}`} />
                                        <div className={`eq-bar ${trackTheme.text}`} />
                                        <div className={`eq-bar ${trackTheme.text}`} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-sm text-slate-600 italic leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    "{track.reason}"
                                  </div>
                                  
                                  {activeTrack === idx && track.otherParts && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {track.otherParts.map((part: any, pIdx: number) => (
                                        <button
                                          key={pIdx}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleTrackPlay(idx, part.startTime);
                                          }}
                                          className={`px-3 py-1.5 text-xs font-bold bg-white text-slate-600 hover:${trackTheme.lightBg} hover:${trackTheme.text} border border-slate-200 rounded-lg transition-colors shadow-sm flex items-center gap-1`}
                                        >
                                          <FastForward className="w-3 h-3" /> {part.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                {activeTrack === idx && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsPreviewMode(true);
                                      setTimeout(() => {
                                        if (audioRef.current && videoRef.current) {
                                          audioRef.current.currentTime = generatedTracks[idx].bestStartTime || 0;
                                          videoRef.current.currentTime = 0;
                                          audioRef.current.play();
                                          videoRef.current.play();
                                          setIsPlaying(true);
                                        }
                                      }, 100);
                                    }}
                                    className={`group sm:ml-4 shrink-0 px-5 py-3 flex items-center justify-center gap-2 bg-gradient-to-r ${trackTheme.from} ${trackTheme.to} text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 w-full sm:w-auto mt-4 sm:mt-0`}
                                    title="Go to Preview & Download"
                                  >
                                    Preview <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                  </button>
                                )}
                              </div>
                            )})}
                          </div>
                        )}
                      </div>
                    )}

                    {genState === 'complete' && (
                      <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                              <MessageSquare className="w-4 h-4 text-rose-600" />
                            </div>
                            <h2 className="text-base font-bold text-slate-800">AI Captions</h2>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Caption Language</label>
                            <div className="relative">
                              <select 
                                value={captionLanguage}
                                onChange={(e) => setCaptionLanguage(e.target.value)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-3 px-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent hover:border-rose-300 hover:bg-white cursor-pointer font-medium transition-all duration-300"
                              >
                                {CAPTION_LANGUAGES.map(lang => (
                                  <option key={lang} value={lang}>{lang}</option>
                                ))}
                              </select>
                              <ChevronRight className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                            </div>
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={handleGenerateCaptions}
                              disabled={isGeneratingCaptions}
                              className="group w-full sm:w-auto px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-all duration-300 ease-out flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-md hover:-translate-y-0.5 active:scale-95 active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                            >
                              {isGeneratingCaptions ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                              ) : (
                                <><Sparkles className="w-4 h-4 transition-transform group-hover:scale-110 group-hover:rotate-12" /> {captions.length > 0 ? 'Regenerate Captions' : 'Generate Captions'}</>
                              )}
                            </button>
                          </div>
                        </div>

                        {captions.length > 0 && (
                          <div className="space-y-4">
                            {captions.map((caption, idx) => (
                              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap pr-10">{caption}</p>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(caption)}
                                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 opacity-0 group-hover:opacity-100"
                                  title="Copy to clipboard"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Floating Player (Bottom Bar) */}
      <AnimatePresence>
        {activeTrack !== null && !isPreviewMode && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100">
              <div 
                className={`h-full bg-gradient-to-r ${activeTheme.from} ${activeTheme.to} transition-all duration-100 ease-linear`}
                style={{ width: `${audioProgress}%` }}
              />
            </div>
            
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center shrink-0 border-2 border-white shadow-md ${isPlaying ? 'animate-spin-slow' : ''}`}>
                  <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${activeTheme.from} ${activeTheme.to} border-2 border-slate-900`} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{generatedTracks[activeTrack].name}</h4>
                  <p className="text-xs font-medium text-slate-500 truncate">{generatedTracks[activeTrack].singer}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <button 
                  onClick={() => handleTrackPlay(activeTrack, 0)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:scale-110 active:scale-95 transition-all duration-200"
                >
                  <Rewind className="w-5 h-5" />
                </button>
                <button 
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center hover:scale-110 active:scale-90 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-slate-900/20"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <button 
                  onClick={() => {
                    const next = (activeTrack + 1) % generatedTracks.length;
                    handleTrackPlay(next);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:scale-110 active:scale-95 transition-all duration-200"
                >
                  <FastForward className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 flex justify-end">
                <button 
                  onClick={() => {
                    setIsPreviewMode(true);
                    setTimeout(() => {
                      if (audioRef.current && videoRef.current) {
                        audioRef.current.currentTime = generatedTracks[activeTrack].bestStartTime || 0;
                        videoRef.current.currentTime = 0;
                        audioRef.current.play();
                        videoRef.current.play();
                        setIsPlaying(true);
                      }
                    }, 100);
                  }}
                  className={`group px-6 py-2.5 ${activeTheme.lightBg} ${activeTheme.text} font-bold rounded-full hover:opacity-80 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 active:translate-y-0 text-sm flex items-center gap-2`}
                >
                  Open Studio <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
