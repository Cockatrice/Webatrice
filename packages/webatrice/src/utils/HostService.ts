import { Host } from '@app/types';
export const DefaultHosts: Host[] = [
  {
    name: 'Chickatrice',
    host: 'mtg.chickatrice.net',
    port: '443',
    editable: false,
  },
  {
    name: 'Rooster',
    host: 'server.cockatrice.us/servatrice',
    port: '4748',
    editable: false,
  },
  {
    name: 'Rooster Beta',
    host: 'beta.cockatrice.us/servatrice',
    port: '4748',
    editable: false,
  },
  {
    name: 'Tetrarch',
    host: 'mtg.tetrarch.co/servatrice',
    port: '443',
    editable: false,
  },
];

export const getHostPort = (host: Host): { host: string, port: string } => {
  if (!host) {
    return {
      host: '',
      port: ''
    };
  }

  return {
    host: host.host,
    port: host.port,
  };
};
