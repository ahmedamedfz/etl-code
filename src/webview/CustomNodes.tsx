import { SourceNode } from './components/nodes/SourceNode';
import { TransformerNode } from './components/nodes/TransformerNode';
import { TargetNode } from './components/nodes/TargetNode';

export const nodeTypes = {
  source: SourceNode,
  transformer: TransformerNode,
  target: TargetNode,
};