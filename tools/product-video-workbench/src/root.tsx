import React from 'react';
import {Composition} from 'remotion';
import {AgentTreasuryV2} from './video';

export const Root: React.FC = () => (
  <Composition id="AgentTreasuryV2" component={AgentTreasuryV2} width={1920} height={1080} fps={30} durationInFrames={2100} />
);
