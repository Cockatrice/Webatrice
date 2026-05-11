import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-core';

import './Decks.css';

function Decks() {
  return (
    <Layout>
      <AuthGuard />
      <span>Decks</span>
    </Layout>
  );
}

export default Decks;
