/** Optional in-process bridge; absence falls back to the existing desktop URI. */
export async function playInYingjianPlugin(player: unknown, video: string, time: number, note: string, vaultId: string): Promise<boolean> {
  const candidate = player as { videoApi?: { version?: number; play?: (video: string, time: number, note: string, vaultId: string) => Promise<void> } } | undefined
  if (candidate?.videoApi?.version !== 1 || typeof candidate.videoApi.play !== 'function') return false
  // A rejected in-process request must not silently launch a second application.
  await candidate.videoApi.play(video, time, note, vaultId)
  return true
}
