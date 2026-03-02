"""
CrewAI Integration Example
Demonstrates how to integrate EvalGate workflow tracing with CrewAI crews

This example shows:
- Automatic tracing of CrewAI crew executions
- Decision auditing for agent task assignments
- Cost tracking per LLM call
- Human-in-the-loop escalation

Requirements:
    pip install crewai pauly4010-evalgate-sdk
"""

import os
import time
import functools
from typing import unknown, Dict, List, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime

# ============================================================================
# EVALAI SDK TYPES (Python equivalent)
# ============================================================================


@dataclass
class DecisionAlternative:
    """Alternative action that was considered but not chosen"""

    action: str
    confidence: float
    reasoning: Optional[str] = None
    rejected_reason: Optional[str] = None


@dataclass
class Decision:
    """Agent decision record"""

    agent: str
    type: str  # 'action', 'tool', 'delegate', 'respond', 'route'
    chosen: str
    alternatives: List[DecisionAlternative]
    reasoning: Optional[str] = None
    confidence: Optional[int] = None
    context_factors: Optional[List[str]] = None
    input_context: Optional[Dict[str, unknown]] = None


@dataclass
class CostRecord:
    """Cost record for LLM calls"""

    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_cost: str
    output_cost: str
    total_cost: str
    category: str = "llm"
    is_retry: bool = False


@dataclass
class WorkflowContext:
    """Active workflow context"""

    id: str
    name: str
    started_at: str
    metadata: Optional[Dict[str, unknown]] = None


# ============================================================================
# EVALAI TRACER (Python Implementation)
# ============================================================================


class EvalGateTracer:
    """
    EvalGate Workflow Tracer for Python

    Example:
        tracer = EvalGateTracer(api_key=os.environ['EVALAI_API_KEY'])

        with tracer.workflow('Market Research Crew'):
            tracer.record_decision(Decision(...))
            tracer.record_cost(CostRecord(...))
    """

    def __init__(
        self,
        api_key: str,
        organization_id: Optional[int] = None,
        base_url: str = "https://evalgate.com",
        debug: bool = False,
    ):
        self.api_key = api_key
        self.organization_id = organization_id
        self.base_url = base_url
        self.debug = debug
        self._current_workflow: Optional[WorkflowContext] = None
        self._decisions: List[Decision] = []
        self._costs: List[CostRecord] = []
        self._handoffs: List[Dict[str, unknown]] = []

    def workflow(self, name: str, metadata: Optional[Dict[str, unknown]] = None):
        """Context manager for workflow tracing"""
        return WorkflowContextManager(self, name, metadata)

    def start_workflow(
        self, name: str, metadata: Optional[Dict[str, unknown]] = None
    ) -> WorkflowContext:
        """Start a new workflow"""
        if self._current_workflow:
            raise RuntimeError(
                "A workflow is already active. Call end_workflow() first."
            )

        self._current_workflow = WorkflowContext(
            id=f"wf-{int(time.time() * 1000)}",
            name=name,
            started_at=datetime.utcnow().isoformat(),
            metadata=metadata,
        )
        self._decisions = []
        self._costs = []
        self._handoffs = []

        self._log(f"Started workflow: {name}")
        return self._current_workflow

    def end_workflow(
        self, output: Optional[Dict[str, unknown]] = None, status: str = "completed"
    ):
        """End the current workflow"""
        if not self._current_workflow:
            raise RuntimeError("No active workflow.")

        duration_ms = int(
            (time.time() * 1000)
            - int(
                datetime.fromisoformat(
                    self._current_workflow.started_at.replace("Z", "+00:00")
                ).timestamp()
                * 1000
            )
        )

        total_cost = sum(float(c.total_cost) for c in self._costs)

        # In production, this would send to the EvalGate API
        self._log(
            f"Ended workflow: {self._current_workflow.name}",
            {
                "status": status,
                "duration_ms": duration_ms,
                "total_cost": f"{total_cost:.6f}",
                "decisions": len(self._decisions),
                "handoffs": len(self._handoffs),
            },
        )

        self._current_workflow = None

    def record_decision(self, decision: Decision):
        """Record an agent decision"""
        if not self._current_workflow:
            raise RuntimeError("No active workflow.")

        self._decisions.append(decision)
        self._log(
            f"Decision: {decision.agent} chose {decision.chosen}",
            {
                "type": decision.type,
                "confidence": decision.confidence,
            },
        )

    def record_cost(self, cost: CostRecord):
        """Record cost for an LLM call"""
        self._costs.append(cost)
        self._log(
            f"Cost: {cost.provider}/{cost.model}",
            {
                "tokens": cost.total_tokens,
                "cost": cost.total_cost,
            },
        )

    def record_handoff(
        self,
        from_agent: Optional[str],
        to_agent: str,
        context: Optional[Dict[str, unknown]] = None,
        handoff_type: str = "delegation",
    ):
        """Record a handoff between agents"""
        if not self._current_workflow:
            raise RuntimeError("No active workflow.")

        handoff = {
            "from_agent": from_agent,
            "to_agent": to_agent,
            "handoff_type": handoff_type,
            "context": context,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._handoffs.append(handoff)
        self._log(f"Handoff: {from_agent or 'start'} → {to_agent}")

    def get_total_cost(self) -> float:
        """Get total cost for current workflow"""
        return sum(float(c.total_cost) for c in self._costs)

    def _log(self, message: str, data: Optional[Dict[str, unknown]] = None):
        """Log if debug mode enabled"""
        if self.debug:
            print(f"[EvalGate] {message}", data or "")


class WorkflowContextManager:
    """Context manager for workflow tracing"""

    def __init__(
        self,
        tracer: EvalGateTracer,
        name: str,
        metadata: Optional[Dict[str, unknown]] = None,
    ):
        self.tracer = tracer
        self.name = name
        self.metadata = metadata
        self._error: Optional[Exception] = None

    def __enter__(self) -> WorkflowContext:
        return self.tracer.start_workflow(self.name, self.metadata)

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.tracer.end_workflow(output={"error": str(exc_val)}, status="failed")
        else:
            self.tracer.end_workflow(status="completed")
        return False


# ============================================================================
# CREWAI DECORATOR
# ============================================================================


def trace_crewai(
    workflow_name: str,
    tracer: Optional[EvalGateTracer] = None,
    api_key: Optional[str] = None,
):
    """
    Decorator to trace CrewAI crew executions

    Example:
        @trace_crewai(workflow_name='market_research')
        class MarketResearchCrew:
            @agent
            def researcher(self):
                return Agent(role='Research Analyst', ...)

            @task
            def analyze_competitors(self):
                return Task(description='...', agent=self.researcher())
    """

    def decorator(cls):
        _tracer = tracer or EvalGateTracer(
            api_key=api_key or os.environ.get("EVALAI_API_KEY", ""), debug=True
        )

        original_kickoff = getattr(cls, "kickoff", None)

        @functools.wraps(original_kickoff or (lambda self: None))
        def traced_kickoff(self, *args, **kwargs):
            with _tracer.workflow(workflow_name, {"crew_class": cls.__name__}):
                # Record crew start
                _tracer.record_decision(
                    Decision(
                        agent="CrewOrchestrator",
                        type="action",
                        chosen="start_crew",
                        alternatives=[],
                        reasoning=f"Starting {cls.__name__} execution",
                        confidence=100,
                    )
                )

                # Get agents and tasks if available
                agents = []
                tasks = []

                for attr_name in dir(self):
                    attr = getattr(self, attr_name, None)
                    if callable(attr):
                        if hasattr(attr, "_is_agent"):
                            agents.append(attr_name)
                        elif hasattr(attr, "_is_task"):
                            tasks.append(attr_name)

                # Record handoffs for each task
                prev_agent = None
                for task_name in tasks:
                    task_agent = f"{cls.__name__}.{task_name}"
                    _tracer.record_handoff(prev_agent, task_agent, {"task": task_name})
                    prev_agent = task_agent

                # Execute original kickoff
                if original_kickoff:
                    result = original_kickoff(self, *args, **kwargs)
                else:
                    result = None

                # Record completion
                _tracer.record_decision(
                    Decision(
                        agent="CrewOrchestrator",
                        type="action",
                        chosen="complete_crew",
                        alternatives=[],
                        reasoning="Crew execution completed successfully",
                        confidence=100,
                    )
                )

                return result

        if original_kickoff:
            cls.kickoff = traced_kickoff

        # Store tracer reference
        cls._evalai_tracer = _tracer

        return cls

    return decorator


# ============================================================================
# EXAMPLE USAGE
# ============================================================================


def example_market_research_crew():
    """
    Example: Market Research Crew with EvalGate tracing

    This demonstrates how a CrewAI crew would be instrumented.
    In production, you would use actual CrewAI Agent and Task classes.
    """

    # Initialize tracer
    tracer = EvalGateTracer(
        api_key=os.environ.get("EVALAI_API_KEY", "demo-key"), debug=True
    )

    with tracer.workflow(
        "Market Research Analysis",
        {"industry": "AI/ML", "competitors": ["OpenAI", "Anthropic", "Google"]},
    ):
        # Simulate researcher agent
        tracer.record_handoff(None, "ResearchAnalyst", {"task": "gather_data"})
        tracer.record_decision(
            Decision(
                agent="ResearchAnalyst",
                type="tool",
                chosen="web_search",
                alternatives=[
                    DecisionAlternative("database_query", 0.3, "Could use internal DB"),
                    DecisionAlternative("api_call", 0.2, "Could use external API"),
                ],
                reasoning="Web search provides most comprehensive competitor data",
                confidence=85,
            )
        )

        # Simulate LLM cost
        tracer.record_cost(
            CostRecord(
                provider="openai",
                model="gpt-4",
                input_tokens=1500,
                output_tokens=800,
                total_tokens=2300,
                input_cost="0.045000",
                output_cost="0.048000",
                total_cost="0.093000",
            )
        )

        # Simulate analyst agent
        tracer.record_handoff(
            "ResearchAnalyst", "DataAnalyst", {"data_collected": True}
        )
        tracer.record_decision(
            Decision(
                agent="DataAnalyst",
                type="action",
                chosen="generate_report",
                alternatives=[
                    DecisionAlternative(
                        "request_more_data", 0.2, "Could gather more data"
                    ),
                ],
                reasoning="Sufficient data collected for comprehensive analysis",
                confidence=90,
            )
        )

        tracer.record_cost(
            CostRecord(
                provider="openai",
                model="gpt-4",
                input_tokens=2000,
                output_tokens=1500,
                total_tokens=3500,
                input_cost="0.060000",
                output_cost="0.090000",
                total_cost="0.150000",
            )
        )

        print(f"\nTotal workflow cost: ${tracer.get_total_cost():.4f}")


# ============================================================================
# GOVERNANCE INTEGRATION
# ============================================================================


@dataclass
class GovernanceConfig:
    """Governance configuration for CrewAI"""

    confidence_threshold: float = 0.7
    amount_threshold: float = 500.0
    require_approval_for_sensitive_data: bool = True
    allowed_models: List[str] = field(default_factory=list)
    max_cost_per_run: float = 10.0
    audit_level: str = "SOC2"


def check_governance(
    decision: Decision, config: GovernanceConfig
) -> Dict[str, unknown]:
    """
    Check if a decision requires approval or should be blocked

    Returns:
        dict with 'requires_approval', 'blocked', and 'reasons' keys
    """
    reasons = []
    requires_approval = False
    blocked = False

    # Check confidence threshold
    if decision.confidence and decision.confidence / 100 < config.confidence_threshold:
        requires_approval = True
        reasons.append(
            f"Low confidence ({decision.confidence}% < {config.confidence_threshold * 100}%)"
        )

    # Check for fraud indicators in alternatives
    for alt in decision.alternatives:
        if alt.reasoning and "fraud" in alt.reasoning.lower() and alt.confidence > 0.3:
            blocked = True
            reasons.append("Potential fraud risk detected")
            break

    # Block extremely low confidence
    if decision.confidence and decision.confidence < 30:
        blocked = True
        reasons.append(f"Extremely low confidence ({decision.confidence}%)")

    return {
        "requires_approval": requires_approval,
        "blocked": blocked,
        "reasons": reasons,
        "audit_level": config.audit_level,
    }


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("EvalGate + CrewAI Integration Example")
    print("=" * 50)
    example_market_research_crew()
