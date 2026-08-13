/**
 * Seeking a <video> to an exact timestamp, reliably enough to drive
 * frame-by-frame analysis and to re-show a specific frame afterwards.
 *
 * The naive version - set `currentTime`, wait for `seeked` - has two ways
 * to fail, and both showed up in practice:
 *
 * 1. Browsers snap `currentTime` to the nearest decodable frame, so a value
 *    just written back rarely compares exactly equal afterwards. Guarding
 *    with `video.currentTime === target` therefore misfires on a repeat
 *    request for the same moment: it writes the same `currentTime` again,
 *    the browser considers the position unchanged and never fires `seeked`,
 *    and the caller waits forever.
 * 2. `seeked` can simply not arrive (seen on Safari/iOS with a video that
 *    is still buffering), which would strand an analysis mid-run.
 *
 * So: compare with a tolerance, and never wait unbounded.
 */

/** Half a frame at 30fps - close enough to count as "already there". */
const SEEK_EPSILON_SECONDS = 1 / 60;

/** Give up waiting for `seeked` and let the caller proceed with whatever frame is current. */
const SEEK_TIMEOUT_MS = 2000;

export function seekTo(video: HTMLVideoElement, targetSeconds: number): Promise<void> {
  if (video.readyState >= 2 && Math.abs(video.currentTime - targetSeconds) < SEEK_EPSILON_SECONDS) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, SEEK_TIMEOUT_MS);
    video.addEventListener("seeked", finish);
    video.currentTime = targetSeconds;
  });
}
