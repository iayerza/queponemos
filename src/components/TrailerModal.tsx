import { openBrowserAsync } from 'expo-web-browser';

export async function openTrailer(youtubeKey: string): Promise<void> {
  await openBrowserAsync(`https://www.youtube.com/watch?v=${youtubeKey}`, {
    toolbarColor: '#0D0D0F',
    controlsColor: '#C8302A',
  });
}
