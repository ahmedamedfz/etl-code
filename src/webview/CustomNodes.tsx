import { SourceNode } from './components/nodes/SourceNode';
import { TransformerNode } from './components/nodes/TransformerNode';
import { TargetNode } from './components/nodes/TargetNode';
import { SystemNode } from './components/nodes/SystemNode';

export const nodeTypes = {
  source: SourceNode,
  transformer: TransformerNode,
  target: TargetNode,
  system: SystemNode,
};