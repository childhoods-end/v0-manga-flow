// /lib/loadOpenCV.ts
let loading: Promise<typeof cv> | null = null;

export async function loadOpenCV(): Promise<typeof cv> {
  if (typeof window === 'undefined') throw new Error('OpenCV must run in browser');
  if ((window as any).cv && (window as any).cv['onRuntimeInitialized']) {
    const cvRef = (window as any).cv as typeof cv;
    if ((cvRef as any)._loaded) return cvRef;
  }
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.x/opencv.js';
      script.async = true;
      script.onload = () => {
        const cvRef = (window as any).cv as typeof cv;
        cvRef['onRuntimeInitialized'] = () => {
          (cvRef as any)._loaded = true;
          resolve(cvRef);
        };
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return loading;
}
