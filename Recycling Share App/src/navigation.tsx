import { createContext, useContext, useState, type ReactNode } from 'react';

export type Route =
  | { screen: 'home' }
  | { screen: 'explore' }
  | { screen: 'messages' }
  | { screen: 'profile'; userId?: string }
  | { screen: 'chat'; userId: string }
  | { screen: 'notifications' }
  | { screen: 'friends' }
  | { screen: 'onboarding' }
  | { screen: 'otp'; phone?: string }
  | { screen: 'forgot-password' }
  | { screen: 'edit-profile' }
  | { screen: 'settings' }
  | { screen: 'privacy-settings' }
  | { screen: 'my-impact' }
  | { screen: 'badges' }
  | { screen: 'post-detail'; postId: string }
  | { screen: 'image-viewer'; url: string }
  | { screen: 'hashtag'; tag: string }
  | { screen: 'search' }
  | { screen: 'guide-detail'; tipId: string }
  | { screen: 'recycling-map' }
  | { screen: 'material-guide' }
  | { screen: 'challenge-detail'; challengeId: string }
  | { screen: 'leaderboard' }
  | { screen: 'reward-shop' }
  | { screen: 'market-detail'; itemId: string }
  | { screen: 'create-listing' }
  | { screen: 'groups' }
  | { screen: 'group-detail'; groupId: string }
  | { screen: 'events' }
  | { screen: 'scanner' }
  | { screen: 'help-center' }
  | { screen: 'report'; postId?: string }
  | { screen: 'recycling-point-detail'; pointId: string };

interface NavCtx {
  push: (route: Route) => void;
  pop: () => void;
  replace: (route: Route) => void;
  stack: Route[];
}

const Ctx = createContext<NavCtx>({ push: () => {}, pop: () => {}, replace: () => {}, stack: [] });

export const useNav = () => useContext(Ctx);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([]);
  const push = (r: Route) => setStack(s => [...s, r]);
  const pop = () => setStack(s => s.slice(0, -1));
  const replace = (r: Route) => setStack(s => [...s.slice(0, -1), r]);
  return <Ctx.Provider value={{ push, pop, replace, stack }}>{children}</Ctx.Provider>;
}
