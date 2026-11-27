/**
 * What a tap on « Continuer avec Google » does. Clerk (the Google sign-in
 * runtime) loads only when the login window opens, so a quick tap can come
 * before it is ready: the tap then waits for Clerk instead of failing with
 * « La connexion sociale n'est pas encore prête ».
 */
export type GoogleTapAction = 'ignore' | 'wait' | 'start';

export function googleTapAction(opts: { busy: boolean; configured: boolean; canStart: boolean }): GoogleTapAction {
  if (opts.busy) return 'ignore';
  // Not configured: start() explains it right away, waiting would not help.
  if (opts.configured && !opts.canStart) return 'wait';
  return 'start';
}
