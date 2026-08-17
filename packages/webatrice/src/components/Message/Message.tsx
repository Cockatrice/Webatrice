import { NavLink, generatePath } from 'react-router-dom';
import type { ReactNode } from 'react';

import { CALLOUT_BOUNDARY_REGEX, CARD_CALLOUT_REGEX, MENTION_REGEX, RouteEnum, URL_REGEX } from '@app/types';
import UserActionsMenu from '../UserDisplay/UserActionsMenu';
import { useUserDisplay } from '../UserDisplay/useUserDisplay';
import CardCallout from './CardCallout';
import { useParsedMessage } from './useMessage';
import './Message.css';

interface MessagePayload {
  message: string;
}

interface MessageProps {
  message: MessagePayload;
}

const Message = ({ message: { message } }: MessageProps) => (
  <div className='message'>
    <div className='message__detail'>
      <ParsedMessage message={message} />
    </div>
  </div>
);

interface ParsedMessageProps {
  message: string;
}

const ParsedMessage = ({ message }: ParsedMessageProps) => {
  const { name, chunks } = useParsedMessage(message, parseChunks);

  return (
    <div>
      {name && (<strong><PlayerLink name={name} />:</strong>)}
      {chunks}
    </div>
  );
};

interface PlayerLinkProps {
  name: string;
  label?: string;
}

/**
 * Author name / @mention link inside a chat message. Left-click still
 * navigates to the Player page (which hosts the private-chat panel);
 * right-click opens the same UserActionsMenu the Buddies / Players
 * Online rows use, so the "Private chat" entry point is consistent
 * across the app. Cockatrice-parity: right-click on a name anywhere
 * in the desktop client also brings up this menu.
 */
const PlayerLink = ({ name, label = name }: PlayerLinkProps) => {
  const {
    position,
    isABuddy,
    isIgnored,
    handleClick,
    handleClose,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
  } = useUserDisplay(name);
  return (
    <>
      <NavLink
        className="link"
        to={generatePath(RouteEnum.PLAYER, { name })}
        onContextMenu={handleClick}
      >
        {label}
      </NavLink>
      {position && (
        <UserActionsMenu
          x={position.x}
          y={position.y}
          onClose={handleClose}
          name={name}
          isABuddy={isABuddy}
          isIgnored={isIgnored}
          onAddBuddy={onAddBuddy}
          onRemoveBuddy={onRemoveBuddy}
          onAddIgnore={onAddIgnore}
          onRemoveIgnore={onRemoveIgnore}
        />
      )}
    </>
  );
};

function parseChunks(chunk: string, index: number): ReactNode {
  if (chunk.match(CARD_CALLOUT_REGEX)) {
    const name = chunk.replace(CALLOUT_BOUNDARY_REGEX, '').trim();
    return (<CardCallout name={name} key={index}></CardCallout>);
  }

  if (chunk.match(URL_REGEX)) {
    return parseUrlChunk(chunk);
  }

  if (chunk.match(MENTION_REGEX)) {
    return parseMentionChunk(chunk);
  }

  return chunk;
}

function parseUrlChunk(chunk: string): ReactNode {
  return chunk.split(URL_REGEX)
    .filter((urlChunk) => !!urlChunk)
    .map((urlChunk, index) => {
      if (urlChunk.match(URL_REGEX)) {
        return (<a className='link' href={urlChunk} key={index} target='_blank' rel='noopener noreferrer'>{urlChunk}</a>);
      }

      return urlChunk;
    });
}

function parseMentionChunk(chunk: string): ReactNode {
  return chunk.split(MENTION_REGEX)
    .filter((mentionChunk) => !!mentionChunk)
    .map((mentionChunk, index) => {
      const mention = mentionChunk.match(MENTION_REGEX);

      if (mention) {
        const name = mention[0].substr(1);
        return (<PlayerLink name={name} label={mention[0]} key={index} />);
      }

      return mentionChunk;
    });
}

export default Message;
