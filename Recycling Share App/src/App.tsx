import { useState } from 'react';
import { users, CURRENT_USER_ID } from './data';
import { NavProvider, useNav, type Route } from './navigation';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import ExploreScreen from './screens/ExploreScreen';
import MessagesScreen from './screens/MessagesScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import FriendsScreen from './screens/FriendsScreen';
import BottomNav from './components/BottomNav';
import CreatePostModal from './components/CreatePostModal';
import PostDetailScreen from './screens/PostDetailScreen';
import ImageViewerScreen from './screens/ImageViewerScreen';
import HashtagScreen from './screens/HashtagScreen';
import SearchScreen from './screens/SearchScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import PrivacySettingsScreen from './screens/PrivacySettingsScreen';
import MyImpactScreen from './screens/MyImpactScreen';
import BadgesScreen from './screens/BadgesScreen';
import RecyclingGuideDetailScreen from './screens/RecyclingGuideDetailScreen';
import RecyclingMapScreen from './screens/RecyclingMapScreen';
import MaterialGuideScreen from './screens/MaterialGuideScreen';
import ChallengeDetailScreen from './screens/ChallengeDetailScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import RewardShopScreen from './screens/RewardShopScreen';
import MarketItemDetailScreen from './screens/MarketItemDetailScreen';
import CreateListingScreen from './screens/CreateListingScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import EventsScreen from './screens/EventsScreen';
import ScannerScreen from './screens/ScannerScreen';
import HelpCenterScreen from './screens/HelpCenterScreen';
import ReportScreen from './screens/ReportScreen';
import OTPScreen from './screens/OTPScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import RecyclingPointDetailScreen from './screens/RecyclingPointDetailScreen';

export type Tab = 'home' | 'explore' | 'messages' | 'profile';

export default function App() {
  const [onboarded, setOnboarded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authOverlay, setAuthOverlay] = useState<'otp' | 'forgot' | null>(null);

  if (!onboarded) {
    return <PhoneFrame><OnboardingScreen onComplete={() => setOnboarded(true)} /></PhoneFrame>;
  }

  if (!authenticated) {
    if (authOverlay === 'otp') {
      return <PhoneFrame><OTPScreen onBack={() => setAuthOverlay(null)} onVerify={() => { setAuthOverlay(null); setAuthenticated(true); }} /></PhoneFrame>;
    }
    if (authOverlay === 'forgot') {
      return <PhoneFrame><ForgotPasswordScreen onBack={() => setAuthOverlay(null)} onSent={() => setAuthOverlay('otp')} /></PhoneFrame>;
    }
    return (
      <PhoneFrame>
        <LoginScreen
          mode={authMode}
          onAuth={() => { if (authMode === 'register') { setAuthOverlay('otp'); } else { setAuthenticated(true); } }}
          onToggle={() => setAuthMode(m => m === 'login' ? 'register' : 'login')}
          onForgotPassword={() => setAuthOverlay('forgot')}
        />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <NavProvider>
        <AuthenticatedApp />
      </NavProvider>
    </PhoneFrame>
  );
}

function AuthenticatedApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [showCreate, setShowCreate] = useState(false);
  const { stack, pop, push } = useNav();
  const overlay = stack[stack.length - 1] as Route | undefined;
  const currentUser = users.find(u => u.id === CURRENT_USER_ID)!;

  const handleTab = (t: Tab) => { setTab(t); };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#f0fdf4' }}>
      <div className="flex-1 overflow-hidden relative">
        {/* Tab screens — always rendered so state is preserved */}
        <div className={overlay ? 'hidden' : 'h-full'}>
          {tab === 'home' && <HomeScreen currentUser={currentUser} />}
          {tab === 'explore' && <ExploreScreen />}
          {tab === 'messages' && <MessagesScreen currentUserId={CURRENT_USER_ID} />}
          {tab === 'profile' && <ProfileScreen userId={CURRENT_USER_ID} isOwnProfile />}
        </div>

        {/* Stack overlay screens */}
        {overlay && (
          <div className="absolute inset-0 z-40 slide-in-right h-full">
            <OverlayRouter route={overlay} onBack={pop} onPush={push} currentUserId={CURRENT_USER_ID} />
          </div>
        )}

        {/* Create post modal */}
        {showCreate && !overlay && (
          <CreatePostModal currentUser={currentUser} onClose={() => setShowCreate(false)} />
        )}
      </div>

      {!overlay && !showCreate && (
        <BottomNav active={tab} onTab={handleTab} onCreate={() => setShowCreate(true)} />
      )}
    </div>
  );
}

function OverlayRouter({ route, onBack, onPush, currentUserId }: {
  route: Route; onBack: () => void;
  onPush: (r: Route) => void;
  currentUserId: string;
}) {
  switch (route.screen) {
    case 'post-detail': return <PostDetailScreen postId={route.postId} onBack={onBack} onPush={onPush} />;
    case 'image-viewer': return <ImageViewerScreen url={route.url} onBack={onBack} />;
    case 'hashtag': return <HashtagScreen tag={route.tag} onBack={onBack} onPush={onPush} />;
    case 'search': return <SearchScreen onBack={onBack} onPush={onPush} />;
    case 'profile': return <ProfileScreen userId={route.userId || currentUserId} isOwnProfile={route.userId === currentUserId || !route.userId} onBack={onBack} />;
    case 'chat': return <MessagesScreen currentUserId={currentUserId} initialChatUserId={route.userId} onBack={onBack} />;
    case 'notifications': return <NotificationsScreen onBack={onBack} />;
    case 'friends': return <FriendsScreen onBack={onBack} />;
    case 'edit-profile': return <EditProfileScreen onBack={onBack} />;
    case 'settings': return <SettingsScreen onBack={onBack} onPush={onPush} />;
    case 'privacy-settings': return <PrivacySettingsScreen onBack={onBack} />;
    case 'my-impact': return <MyImpactScreen onBack={onBack} />;
    case 'badges': return <BadgesScreen onBack={onBack} />;
    case 'guide-detail': return <RecyclingGuideDetailScreen tipId={route.tipId} onBack={onBack} />;
    case 'recycling-map': return <RecyclingMapScreen onBack={onBack} onPush={onPush} />;
    case 'material-guide': return <MaterialGuideScreen onBack={onBack} />;
    case 'challenge-detail': return <ChallengeDetailScreen challengeId={route.challengeId} onBack={onBack} />;
    case 'leaderboard': return <LeaderboardScreen onBack={onBack} />;
    case 'reward-shop': return <RewardShopScreen onBack={onBack} />;
    case 'market-detail': return <MarketItemDetailScreen itemId={route.itemId} onBack={onBack} />;
    case 'create-listing': return <CreateListingScreen onBack={onBack} />;
    case 'groups': return <GroupsScreen onBack={onBack} onPush={onPush} />;
    case 'group-detail': return <GroupDetailScreen groupId={route.groupId} onBack={onBack} />;
    case 'events': return <EventsScreen onBack={onBack} />;
    case 'scanner': return <ScannerScreen onBack={onBack} />;
    case 'help-center': return <HelpCenterScreen onBack={onBack} />;
    case 'report': return <ReportScreen postId={route.postId} onBack={onBack} />;
    case 'forgot-password': return <ForgotPasswordScreen onBack={onBack} onSent={onBack} />;
    case 'otp': return <OTPScreen onBack={onBack} onVerify={onBack} phone={route.phone} />;
    case 'recycling-point-detail': return <RecyclingPointDetailScreen pointId={route.pointId} onBack={onBack} />;
    default: return null;
  }
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  const isDesktop = window.innerWidth > 500;
  return (
    <div className="flex items-center justify-center w-full" style={{ minHeight: '100dvh', background: 'radial-gradient(ellipse at 50% 40%, #2d6a4f 0%, #1b4332 70%)' }}>
      <div className="relative w-full overflow-hidden bg-white" style={{ maxWidth: 430, height: '100dvh', maxHeight: 932, boxShadow: isDesktop ? '0 0 0 10px #0d1f15, 0 40px 100px rgba(0,0,0,0.9)' : 'none', borderRadius: isDesktop ? 48 : 0 }}>
        {children}
      </div>
    </div>
  );
}
