"use client";

import {
	Bot,
	CheckCircle,
	ChevronRight,
	Clock,
	Cpu,
	GitBranch,
	Layers,
	Play,
	User,
	Wrench,
	XCircle,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowNode {
	id: string;
	type: "agent" | "tool" | "decision" | "parallel" | "human" | "llm";
	name: string;
	config?: Record<string, unknown>;
	// Runtime data (optional)
	status?: "pending" | "running" | "completed" | "failed";
	durationMs?: number;
	cost?: string;
	// Governance data (optional)
	requiresApproval?: boolean;
	blocked?: boolean;
	governanceReasons?: string[];
}

export interface WorkflowEdge {
	from: string;
	to: string;
	condition?: string;
	label?: string;
	// Runtime data (optional)
	active?: boolean;
}

export interface WorkflowDefinition {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	entrypoint: string;
	metadata?: Record<string, unknown>;
}

export interface WorkflowDAGProps {
	definition: WorkflowDefinition;
	className?: string;
	onNodeClick?: (node: WorkflowNode) => void;
	selectedNodeId?: string;
	showLabels?: boolean;
	animated?: boolean;
	direction?: "horizontal" | "vertical";
}

// ============================================================================
// CONSTANTS
// ============================================================================

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const NODE_SPACING_X = 80;
const NODE_SPACING_Y = 100;
const PADDING = 40;

const NODE_COLORS: Record<
	WorkflowNode["type"],
	{ bg: string; border: string; icon: string }
> = {
	agent: {
		bg: "bg-purple-500/10",
		border: "border-purple-500",
		icon: "text-purple-500",
	},
	tool: {
		bg: "bg-green-500/10",
		border: "border-green-500",
		icon: "text-green-500",
	},
	decision: {
		bg: "bg-amber-500/10",
		border: "border-amber-500",
		icon: "text-amber-500",
	},
	parallel: {
		bg: "bg-blue-500/10",
		border: "border-blue-500",
		icon: "text-blue-500",
	},
	human: {
		bg: "bg-pink-500/10",
		border: "border-pink-500",
		icon: "text-pink-500",
	},
	llm: {
		bg: "bg-cyan-500/10",
		border: "border-cyan-500",
		icon: "text-cyan-500",
	},
};

const STATUS_COLORS: Record<string, string> = {
	pending: "text-muted-foreground",
	running: "text-blue-500",
	completed: "text-green-500",
	failed: "text-red-500",
};

// ============================================================================
// LAYOUT ALGORITHM
// ============================================================================

interface LayoutNode extends WorkflowNode {
	x: number;
	y: number;
	level: number;
}

function calculateLayout(
	definition: WorkflowDefinition,
	direction: "horizontal" | "vertical" = "horizontal",
): { nodes: LayoutNode[]; width: number; height: number } {
	const { nodes, edges, entrypoint } = definition;

	// Build adjacency list
	const adjacency = new Map<string, string[]>();
	const inDegree = new Map<string, number>();

	nodes.forEach((node) => {
		adjacency.set(node.id, []);
		inDegree.set(node.id, 0);
	});

	edges.forEach((edge) => {
		adjacency.get(edge.from)?.push(edge.to);
		inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
	});

	// Topological sort with levels (BFS)
	const levels: string[][] = [];
	const visited = new Set<string>();
	let queue = [entrypoint];

	while (queue.length > 0) {
		const level: string[] = [];
		const nextQueue: string[] = [];

		for (const nodeId of queue) {
			if (visited.has(nodeId)) continue;
			visited.add(nodeId);
			level.push(nodeId);

			const neighbors = adjacency.get(nodeId) || [];
			for (const neighbor of neighbors) {
				if (!visited.has(neighbor)) {
					nextQueue.push(neighbor);
				}
			}
		}

		if (level.length > 0) {
			levels.push(level);
		}
		queue = [...new Set(nextQueue)];
	}

	// Add unknown unvisited nodes (disconnected components)
	nodes.forEach((node) => {
		if (!visited.has(node.id)) {
			levels.push([node.id]);
		}
	});

	// Calculate positions
	const layoutNodes: LayoutNode[] = [];
	let maxNodesInLevel = 0;

	levels.forEach((level, levelIndex) => {
		maxNodesInLevel = Math.max(maxNodesInLevel, level.length);

		level.forEach((nodeId, nodeIndex) => {
			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return;

			const totalWidth =
				level.length * NODE_WIDTH + (level.length - 1) * NODE_SPACING_X;
			const startX = -totalWidth / 2 + NODE_WIDTH / 2;

			let x: number, y: number;

			if (direction === "horizontal") {
				x = levelIndex * (NODE_WIDTH + NODE_SPACING_X);
				y = startX + nodeIndex * (NODE_WIDTH + NODE_SPACING_X);
			} else {
				x = startX + nodeIndex * (NODE_WIDTH + NODE_SPACING_X);
				y = levelIndex * (NODE_HEIGHT + NODE_SPACING_Y);
			}

			layoutNodes.push({
				...node,
				x,
				y,
				level: levelIndex,
			});
		});
	});

	// Normalize positions (shift to positive coordinates)
	const minX = Math.min(...layoutNodes.map((n) => n.x));
	const minY = Math.min(...layoutNodes.map((n) => n.y));

	layoutNodes.forEach((node) => {
		node.x = node.x - minX + PADDING;
		node.y = node.y - minY + PADDING;
	});

	const maxX = Math.max(...layoutNodes.map((n) => n.x));
	const maxY = Math.max(...layoutNodes.map((n) => n.y));

	return {
		nodes: layoutNodes,
		width: maxX + NODE_WIDTH + PADDING,
		height: maxY + NODE_HEIGHT + PADDING,
	};
}

// ============================================================================
// COMPONENTS
// ============================================================================

function NodeIcon({
	type,
	className,
}: {
	type: WorkflowNode["type"];
	className?: string;
}) {
	const iconProps = { className: cn("h-4 w-4", className) };

	switch (type) {
		case "agent":
			return <Bot {...iconProps} />;
		case "tool":
			return <Wrench {...iconProps} />;
		case "decision":
			return <GitBranch {...iconProps} />;
		case "parallel":
			return <Layers {...iconProps} />;
		case "human":
			return <User {...iconProps} />;
		case "llm":
			return <Cpu {...iconProps} />;
		default:
			return <Play {...iconProps} />;
	}
}

function StatusIcon({
	status,
	className,
}: {
	status?: string;
	className?: string;
}) {
	if (!status) return null;

	const iconProps = {
		className: cn("h-3 w-3", STATUS_COLORS[status], className),
	};

	switch (status) {
		case "running":
			return (
				<Clock
					{...iconProps}
					className={cn(iconProps.className, "animate-pulse")}
				/>
			);
		case "completed":
			return <CheckCircle {...iconProps} />;
		case "failed":
			return <XCircle {...iconProps} />;
		default:
			return <Clock {...iconProps} />;
	}
}

function DAGNode({
	node,
	isSelected,
	onClick,
	showLabel = true,
}: {
	node: LayoutNode;
	isSelected?: boolean;
	onClick?: () => void;
	showLabel?: boolean;
}) {
	const colors = NODE_COLORS[node.type];

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<g
						transform={`translate(${node.x}, ${node.y})`}
						onClick={onClick}
						className="cursor-pointer"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onClick?.();
							}
						}}
					>
						{/* Node background */}
						<rect
							x={0}
							y={0}
							width={NODE_WIDTH}
							height={NODE_HEIGHT}
							rx={8}
							className={cn(
								"fill-background stroke-2 transition-all",
								isSelected ? "stroke-primary stroke-[3px]" : "stroke-border",
								onClick && "hover:stroke-primary",
							)}
						/>

						{/* Colored accent bar */}
						<rect
							x={0}
							y={0}
							width={4}
							height={NODE_HEIGHT}
							rx={2}
							className={cn(
								"transition-all",
								node.type === "agent" && "fill-purple-500",
								node.type === "tool" && "fill-green-500",
								node.type === "decision" && "fill-amber-500",
								node.type === "parallel" && "fill-blue-500",
								node.type === "human" && "fill-pink-500",
								node.type === "llm" && "fill-cyan-500",
							)}
						/>

						{/* Node content */}
						<foreignObject
							x={8}
							y={8}
							width={NODE_WIDTH - 16}
							height={NODE_HEIGHT - 16}
						>
							<div className="flex flex-col h-full justify-center">
								<div className="flex items-center gap-2">
									<NodeIcon type={node.type} className={colors.icon} />
									<span className="text-xs font-medium truncate flex-1">
										{node.name}
									</span>
									<StatusIcon status={node.status} />
								</div>
								<div className="flex items-center gap-1 ml-6">
									{showLabel && (
										<span className="text-[10px] text-muted-foreground truncate">
											{node.type}
										</span>
									)}
									{node.requiresApproval && (
										<Badge
											variant="outline"
											className="h-4 px-1 text-[8px] bg-amber-500/10 text-amber-600 border-amber-500/30"
										>
											Approval
										</Badge>
									)}
									{node.blocked && (
										<Badge
											variant="outline"
											className="h-4 px-1 text-[8px] bg-red-500/10 text-red-600 border-red-500/30"
										>
											Blocked
										</Badge>
									)}
								</div>
							</div>
						</foreignObject>
					</g>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-xs">
					<div className="space-y-1">
						<p className="font-medium">{node.name}</p>
						<p className="text-xs text-muted-foreground capitalize">
							{node.type}
						</p>
						{node.status && (
							<p className="text-xs">
								Status:{" "}
								<span className={STATUS_COLORS[node.status]}>
									{node.status}
								</span>
							</p>
						)}
						{node.durationMs !== undefined && (
							<p className="text-xs">Duration: {node.durationMs}ms</p>
						)}
						{node.cost && <p className="text-xs">Cost: ${node.cost}</p>}
						{node.config && Object.keys(node.config).length > 0 && (
							<pre className="text-xs bg-muted p-1 rounded mt-1 max-h-20 overflow-auto">
								{JSON.stringify(node.config, null, 2)}
							</pre>
						)}
						{node.requiresApproval && (
							<p className="text-xs text-amber-600 mt-1">
								⚠️ Requires human approval
							</p>
						)}
						{node.blocked && (
							<p className="text-xs text-red-600 mt-1">🚫 Execution blocked</p>
						)}
						{node.governanceReasons && node.governanceReasons.length > 0 && (
							<div className="text-xs mt-1">
								<p className="font-medium">Governance reasons:</p>
								<ul className="list-disc list-inside text-muted-foreground">
									{node.governanceReasons.map((reason) => (
										<li key={reason}>{reason}</li>
									))}
								</ul>
							</div>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function DAGEdge({
	fromNode,
	toNode,
	edge,
	animated = false,
}: {
	fromNode: LayoutNode;
	toNode: LayoutNode;
	edge: WorkflowEdge;
	animated?: boolean;
}) {
	// Calculate edge path
	const fromX = fromNode.x + NODE_WIDTH;
	const fromY = fromNode.y + NODE_HEIGHT / 2;
	const toX = toNode.x;
	const toY = toNode.y + NODE_HEIGHT / 2;

	// Create a curved path
	const midX = (fromX + toX) / 2;
	const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

	// Arrow marker
	const _arrowSize = 8;

	return (
		<g>
			{/* Edge path */}
			<path
				d={path}
				fill="none"
				className={cn(
					"stroke-border stroke-2 transition-all",
					edge.active && "stroke-primary stroke-[3px]",
					animated && edge.active && "animate-pulse",
				)}
				markerEnd="url(#arrowhead)"
			/>

			{/* Edge label */}
			{edge.label && (
				<text
					x={midX}
					y={(fromY + toY) / 2 - 8}
					textAnchor="middle"
					className="fill-muted-foreground text-[10px]"
				>
					{edge.label}
				</text>
			)}

			{/* Condition label */}
			{edge.condition && (
				<foreignObject
					x={midX - 40}
					y={(fromY + toY) / 2 - 24}
					width={80}
					height={20}
				>
					<div className="flex items-center justify-center">
						<span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
							{edge.condition}
						</span>
					</div>
				</foreignObject>
			)}
		</g>
	);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WorkflowDAG({
	definition,
	className,
	onNodeClick,
	selectedNodeId,
	showLabels = true,
	animated = true,
	direction = "horizontal",
}: WorkflowDAGProps) {
	const [layout, setLayout] = React.useState<ReturnType<
		typeof calculateLayout
	> | null>(null);

	React.useEffect(() => {
		if (definition && definition.nodes.length > 0) {
			setLayout(calculateLayout(definition, direction));
		}
	}, [definition, direction]);

	if (!layout || layout.nodes.length === 0) {
		return (
			<div
				className={cn(
					"flex items-center justify-center p-8 text-muted-foreground",
					className,
				)}
			>
				No workflow nodes to display
			</div>
		);
	}

	const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));

	return (
		<div className={cn("overflow-auto", className)}>
			<svg width={layout.width} height={layout.height} className="min-w-full">
				<title>Workflow Diagram</title>
				{/* Define arrow marker */}
				<defs>
					<marker
						id="arrowhead"
						markerWidth="10"
						markerHeight="7"
						refX="9"
						refY="3.5"
						orient="auto"
					>
						<polygon points="0 0, 10 3.5, 0 7" className="fill-border" />
					</marker>
					<marker
						id="arrowhead-active"
						markerWidth="10"
						markerHeight="7"
						refX="9"
						refY="3.5"
						orient="auto"
					>
						<polygon points="0 0, 10 3.5, 0 7" className="fill-primary" />
					</marker>
				</defs>

				{/* Render edges first (behind nodes) */}
				<g className="edges">
					{definition.edges.map((edge, index) => {
						const fromNode = nodeMap.get(edge.from);
						const toNode = nodeMap.get(edge.to);

						if (!fromNode || !toNode) return null;

						return (
							<DAGEdge
								key={`${edge.from}-${edge.to}-${index}`}
								fromNode={fromNode}
								toNode={toNode}
								edge={edge}
								animated={animated}
							/>
						);
					})}
				</g>

				{/* Render nodes */}
				<g className="nodes">
					{layout.nodes.map((node) => (
						<DAGNode
							key={node.id}
							node={node}
							isSelected={selectedNodeId === node.id}
							onClick={onNodeClick ? () => onNodeClick(node) : undefined}
							showLabel={showLabels}
						/>
					))}
				</g>
			</svg>
		</div>
	);
}

// ============================================================================
// MINI VERSION FOR CARDS
// ============================================================================

export function WorkflowDAGMini({
	definition,
	className,
}: {
	definition: WorkflowDefinition;
	className?: string;
}) {
	if (!definition || definition.nodes.length === 0) {
		return null;
	}

	// Show a simplified inline view
	const nodeCount = definition.nodes.length;
	const agentCount = definition.nodes.filter((n) => n.type === "agent").length;
	const toolCount = definition.nodes.filter((n) => n.type === "tool").length;

	return (
		<div
			className={cn(
				"flex items-center gap-2 text-xs text-muted-foreground",
				className,
			)}
		>
			<div className="flex items-center gap-1">
				<Bot className="h-3 w-3 text-purple-500" />
				<span>{agentCount}</span>
			</div>
			<ChevronRight className="h-3 w-3" />
			<div className="flex items-center gap-1">
				<Wrench className="h-3 w-3 text-green-500" />
				<span>{toolCount}</span>
			</div>
			<span className="text-muted-foreground/50">({nodeCount} nodes)</span>
		</div>
	);
}

export default WorkflowDAG;
