import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const extractFrames = async (file: File, numFrames: number = 2): Promise<string[]> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const frames: string[] = [];
    let currentFrame = 0;

    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(frames);
    }, 1500);

    video.onloadedmetadata = () => {
      if (!isFinite(video.duration) || video.duration === 0) {
         clearTimeout(timeoutId);
         URL.revokeObjectURL(url);
         resolve([]);
         return;
      }
      video.currentTime = video.duration / (numFrames + 1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        frames.push(base64);
      }

      currentFrame++;
      if (currentFrame < numFrames) {
        video.currentTime = video.duration / (numFrames + 1) * (currentFrame + 1);
      } else {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        resolve(frames);
      }
    };
    
    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve(frames);
    };
  });
};

export const extractHighlights = async (file: File, targetDuration: number = 15, onProgress?: (msg: string) => void): Promise<File> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      if (!isFinite(video.duration) || video.duration <= targetDuration) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }

      if (onProgress) onProgress('Analyzing video frames...');

      const numFrames = Math.min(10, Math.floor(video.duration / 2));
      const frames: { time: number, data: string }[] = [];
      let currentFrame = 0;

      const captureFrame = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          frames.push({ time: video.currentTime, data: base64 });
        }
        
        currentFrame++;
        if (currentFrame < numFrames) {
          video.currentTime = (video.duration / numFrames) * currentFrame;
        } else {
          URL.revokeObjectURL(url);
          processFrames();
        }
      };

      video.onseeked = captureFrame;
      video.currentTime = 0.1;

      const processFrames = async () => {
        try {
          if (onProgress) onProgress('Identifying best scenes via AI...');
          const prompt = `Act as an expert video editor. I am providing you with frames extracted from a video along with their timestamps (in seconds).
          Analyze the visual content and identify the most attractive, important, or action-packed scenes.
          The total video duration is ${video.duration} seconds.
          I want to create a short highlight reel of approximately ${targetDuration} seconds.
          Select multiple non-overlapping segments from the video that together add up to around ${targetDuration} seconds.
          
          Return ONLY a valid JSON object with this exact structure:
          {
            "segments": [
              { "start": 0, "end": 5, "reason": "Action starts here" },
              { "start": 12, "end": 22, "reason": "Climax of the scene" }
            ]
          }`;
          
          const parts: any[] = frames.map(f => ({
            inlineData: { mimeType: 'image/jpeg', data: f.data }
          }));
          parts.push({ text: prompt });
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { responseMimeType: 'application/json' }
          });
          
          const analysis = JSON.parse(response.text || '{}');
          let segments = analysis.segments || [];
          
          if (segments.length === 0) {
            segments = [{ start: 0, end: targetDuration }];
          }

          if (onProgress) onProgress('Processing video segments...');

          const { FFmpeg } = await import('@ffmpeg/ffmpeg');
          const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
          const ffmpeg = new FFmpeg();
          
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          
          await ffmpeg.writeFile('input.mp4', await fetchFile(file));
          
          let concatText = '';
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const duration = seg.end - seg.start;
            if (onProgress) onProgress(`Extracting scene ${i + 1} of ${segments.length}...`);
            await ffmpeg.exec([
              '-i', 'input.mp4',
              '-ss', String(seg.start),
              '-t', String(duration),
              '-c:v', 'copy',
              '-c:a', 'copy',
              `seg${i}.mp4`
            ]);
            concatText += `file 'seg${i}.mp4'\n`;
          }
          
          if (onProgress) onProgress('Merging scenes...');
          await ffmpeg.writeFile('concat.txt', concatText);
          
          await ffmpeg.exec([
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat.txt',
            '-c', 'copy',
            'output.mp4'
          ]);
          
          const data = await ffmpeg.readFile('output.mp4');
          const trimmedBlob = new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
          resolve(new File([trimmedBlob], 'highlight_reel.mp4', { type: 'video/mp4' }));
        } catch (e) {
          console.error('Failed to extract highlights', e);
          resolve(file);
        }
      };
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
  });
};
