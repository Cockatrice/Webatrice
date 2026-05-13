import { useMemo, useState } from 'react';
import { useNavigate, generatePath } from 'react-router-dom';

import { useLeaveGame } from '@app/hooks';
import { useWebClient } from 'datatrice/react';
import { server, rooms, games } from 'datatrice';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';
export interface LeftNavOption {
  label: string;
  route: RouteEnum;
}

interface LeftNavState {
  anchorEl: Element | null;
  showCardImportDialog: boolean;
  options: LeftNavOption[];
}

export interface LeftNav {
  joinedRooms: ReturnType<typeof rooms.Selectors.getJoinedRooms>;
  joinedGames: ReturnType<typeof games.Selectors.getActiveGames>;
  isConnected: boolean;
  state: LeftNavState;
  handleMenuOpen: (event: React.MouseEvent) => void;
  handleMenuItemClick: (option: LeftNavOption) => void;
  handleMenuClose: () => void;
  leaveRoom: (event: React.MouseEvent, roomId: number) => void;
  leaveGame: (event: React.MouseEvent, gameId: number) => void;
  openImportCardWizard: () => void;
  closeImportCardWizard: () => void;
}

const BASE_OPTIONS: LeftNavOption[] = [
  { label: 'Account', route: RouteEnum.ACCOUNT },
  { label: 'Replays', route: RouteEnum.REPLAYS },
];

const MODERATOR_OPTIONS: LeftNavOption[] = [
  { label: 'Administration', route: RouteEnum.ADMINISTRATION },
  { label: 'Logs', route: RouteEnum.LOGS },
];

export function useLeftNav(): LeftNav {
  const joinedRooms = useAppSelector((state) => rooms.Selectors.getJoinedRooms(state));
  const joinedGames = useAppSelector(games.Selectors.getActiveGames);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const isModerator = useAppSelector(server.Selectors.getIsUserModerator);
  const navigate = useNavigate();
  const webClient = useWebClient();
  const leaveGameRequest = useLeaveGame();
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const [showCardImportDialog, setShowCardImportDialog] = useState(false);

  const options = useMemo<LeftNavOption[]>(
    () => (isModerator ? [...BASE_OPTIONS, ...MODERATOR_OPTIONS] : BASE_OPTIONS),
    [isModerator],
  );

  const state: LeftNavState = { anchorEl, showCardImportDialog, options };

  const handleMenuOpen = (event: React.MouseEvent) => {
    setAnchorEl(event.target as Element);
  };

  const handleMenuItemClick = (option: LeftNavOption) => {
    navigate(generatePath(option.route));
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const leaveRoom = (event: React.MouseEvent, roomId: number) => {
    event.preventDefault();
    webClient.request.rooms.leaveRoom(roomId);
  };

  const leaveGame = (event: React.MouseEvent, gameId: number) => {
    event.preventDefault();
    leaveGameRequest(gameId);
  };

  const openImportCardWizard = () => {
    setShowCardImportDialog(true);
    handleMenuClose();
  };

  const closeImportCardWizard = () => {
    setShowCardImportDialog(false);
  };

  return {
    joinedRooms,
    joinedGames,
    isConnected,
    state,
    handleMenuOpen,
    handleMenuItemClick,
    handleMenuClose,
    leaveRoom,
    leaveGame,
    openImportCardWizard,
    closeImportCardWizard,
  };
}
