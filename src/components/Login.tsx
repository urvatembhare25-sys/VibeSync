import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, Mail, Lock, PlayCircle, Music, Moon, Sun } from 'lucide-react';
import { useTheme } from '../ThemeContext';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const { theme, toggleTheme } = useTheme();

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      setEmailError('Please enter your email in the correct format (e.g., you@example.com)');
      return;
    }
    
    setEmailError('');
    
    if (email && password) {
      setIsLoading(true);
      setTimeout(() => {
        onLogin();
      }, 800);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-500">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:scale-110 transition-all shadow-sm"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Animated Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-violet-300/40 blur-[100px] mix-blend-multiply animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-fuchsia-300/40 blur-[100px] mix-blend-multiply animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-indigo-300/40 blur-[100px] mix-blend-multiply animate-blob animation-delay-4000" />
      </div>
      
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-12 p-6 relative z-10 items-center">
        {/* Left Side - Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden md:flex flex-col justify-center p-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/80 dark:border-slate-700 shadow-sm w-fit mb-8">
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-bold text-violet-900 dark:text-violet-300 tracking-wide uppercase">AI-Powered Music Engine</span>
          </div>
          <h1 className="text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]">
            Score your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400">
              videos instantly.
            </span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-md leading-relaxed mb-10 font-medium">
            Upload any video and let our AI compose the perfect original soundtrack or find the ideal existing song to match the mood, tempo, and cultural vibe.
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex -space-x-4">
              {[1,2,3].map(i => (
                <div key={i} className={`w-12 h-12 rounded-full border-2 border-[#f8fafc] dark:border-slate-950 bg-gradient-to-br from-violet-${i*200} to-fuchsia-${i*200} flex items-center justify-center shadow-sm`}>
                  <Music className="w-4 h-4 text-white/90" />
                </div>
              ))}
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Join <span className="text-slate-900 dark:text-white font-bold">10,000+</span> creators
            </div>
          </div>
        </motion.div>

        {/* Right Side - Login Form */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white dark:border-slate-700">
            <div className="flex flex-col items-center mb-10 md:hidden">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30 mb-4">
                <PlayCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">VibeSync</h2>
            </div>

            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Welcome back</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Enter your details to access your workspace.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                <div className="relative group">
                  <Mail className={`absolute left-4 top-3.5 w-5 h-5 transition-colors ${emailError ? 'text-red-400' : 'text-slate-400 dark:text-slate-500 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-400'}`} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    className={`w-full bg-slate-50/50 dark:bg-slate-800/50 border rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-4 transition-all font-medium ${
                      emailError 
                        ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500/10 focus:border-red-500' 
                        : 'border-slate-200 dark:border-slate-700 focus:ring-violet-500/10 focus:border-violet-500 dark:focus:border-violet-400'
                    }`}
                    placeholder="you@example.com"
                  />
                </div>
                {emailError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 dark:text-red-400 text-xs font-medium mt-2 ml-1"
                  >
                    {emailError}
                  </motion.p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-400 transition-colors" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 dark:focus:border-violet-400 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="group w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold py-4 rounded-2xl transition-all duration-300 ease-out flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 dark:shadow-white/10 hover:shadow-2xl hover:shadow-slate-900/30 dark:hover:shadow-white/20 hover:-translate-y-1 mt-4 active:scale-95 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" /></>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
