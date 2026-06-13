const fs = require('fs');
let code = fs.readFileSync('src/components/WaveformPlayer.tsx', 'utf8');

const mountEffectPattern = /  \/\/ ── Mount effect: create WaveSurfer ONCE; infrastructure persists across file switches ──[\s\S]*?  \/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n  }, \[\]\); \/\/ Mount only\n/;
code = code.replace(mountEffectPattern, '');

const inject = `      // 1. Create a fresh audio pipeline for THIS specific file
      const audioCtx = getAudioContext();
      const freshMedia = document.createElement('audio');
      freshMedia.crossOrigin = 'anonymous';
      const freshSource = audioCtx.createMediaElementSource(freshMedia);
      const freshGain = audioCtx.createGain();
      freshSource.connect(freshGain);
      freshGain.connect(audioCtx.destination);
      
      currentPipelineRef.current = { mediaEl: freshMedia, sourceNode: freshSource, gainNode: freshGain };
      audioContextRef.current = audioCtx;
      gainNodeRef.current = freshGain;

      if (!waveformRef.current) return;
      const ws = WaveSurfer.create({
        container: waveformRef.current,
        media: freshMedia,
        waveColor,
        progressColor,
        cursorColor,
        cursorWidth: 2,
        height: 72,
        normalize: true,
        interact: true,
        dragToSeek: true,
        hideScrollbar: true,
        renderFunction: (channels, ctx) => {
          const { width, height } = ctx.canvas;
          const channel = channels[0];
          if (!channel) return;
          const len = channel.length;
          const step = len / width;
          ctx.beginPath();
          ctx.moveTo(0, height);
          const gain = dbToLinear(volumeDbRef.current);
          for (let x = 0; x < width; x++) {
            const start = Math.floor(x * step);
            const end = Math.max(start + 1, Math.floor((x + 1) * step));
            let maxVal = 0;
            for (let i = start; i < end; i++) {
              const val = Math.abs(channel[i] || 0);
              if (val > maxVal) maxVal = val;
            }
            const amp = Math.min(0.98, maxVal * gain);
            ctx.lineTo(x, height - amp * height);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();
        },
        plugins: [
          TimelinePlugin.create({
            height: 18,
            insertPosition: 'beforebegin',
            style: {
              color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              fontSize: '9px',
              fontFamily: 'monospace',
            },
            formatTimeCallback: (sec) => {
              const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
              const f = Math.floor((sec % 1) * 30);
              return \\\`\\${String(h).padStart(2,'0')}:\\${String(m).padStart(2,'0')}:\\${String(s).padStart(2,'0')}:\\${String(f).padStart(2,'0')}\\\`;
            },
          }),
        ],
      });
      wsRef.current = ws;

      const resizeObserver = new ResizeObserver(() => {
        if (!wsRef.current || !waveformRef.current) return;
        const dur = wsRef.current.getDuration();
        const containerWidth = waveformRef.current.clientWidth ?? 0;
        if (dur > 0 && containerWidth > 0) {
          const fitPxPerSec = containerWidth / dur;
          minZoomRef.current = fitPxPerSec;
          setMinZoom(fitPxPerSec);
          const calculatedMaxZoom = Math.max(200, fitPxPerSec);
          maxZoomRef.current = calculatedMaxZoom;
          setMaxZoom(calculatedMaxZoom);
          setZoom((prev) => {
            if (prev <= minZoomRef.current + 0.1) { wsRef.current?.zoom(fitPxPerSec); return fitPxPerSec; }
            return prev;
          });
        }
        try { ws.setOptions({}); } catch (err) { console.error('Resize setOptions error:', err); }
      });
      resizeObserver.observe(waveformRef.current);

      const handleWheel = (e) => {
        const currentMinZoom = minZoomRef.current;
        const currentMaxZoom = maxZoomRef.current;
        if (e.altKey) {
          e.preventDefault();
          const zoomFactor = e.deltaY > 0 ? -3 : 3;
          const currentZoom = ws.options.minPxPerSec ?? currentMinZoom;
          const newZoom = Math.max(currentMinZoom, Math.min(currentMaxZoom, currentZoom + zoomFactor));
          ws.zoom(newZoom);
          setZoom(newZoom);
        } else {
          e.preventDefault();
          const currentZoom = ws.options.minPxPerSec ?? currentMinZoom;
          if (currentZoom > currentMinZoom + 0.1) {
            const scrollDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            ws.setScroll(ws.getScroll() + scrollDelta);
          }
        }
      };
      waveformRef.current.addEventListener('wheel', handleWheel, { passive: false });

      wsEventUnsubsRef.current.push(() => {
        resizeObserver.disconnect();
        waveformRef.current?.removeEventListener('wheel', handleWheel);
      });`;

const oldLoadPattern = /      const ws = wsRef\.current;\n      if \(!ws\) return; \/\/ mount effect hasn't fired yet \(shouldn't happen in practice\)\n\n      \/\/ 1\. Create a fresh audio pipeline for THIS specific file[\s\S]*?      \/\/ 2\. Hot-swap WaveSurfer's internal media element to our fresh one\n[\s\S]*?      }\n/;
code = code.replace(oldLoadPattern, inject);

const oldCleanup = `      // WaveSurfer NOT destroyed here — instance is reused for the next file switch.
      // It is destroyed only in the mount effect's cleanup on component unmount.`;
const newCleanup = `      const ws = wsRef.current;
      if (ws) {
        try { ws.destroy(); } catch (err) {}
        wsRef.current = null;
      }`;
code = code.replace(oldCleanup, newCleanup);

const oldDiv = `      <div
        ref={waveformRef}
        className="rounded-lg overflow-hidden bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] min-h-[72px]"
      />`;
const newDiv = `      <div
        ref={waveformRef}
        className="rounded-lg overflow-hidden bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] min-h-[72px]"
        style={{ transform: 'translateZ(0)', willChange: 'transform, opacity' }}
      />`;
code = code.replace(oldDiv, newDiv);

fs.writeFileSync('src/components/WaveformPlayer.tsx', code, 'utf8');
console.log('Update complete!');
