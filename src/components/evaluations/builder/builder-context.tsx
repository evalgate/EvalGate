"use client";

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { EvaluationTemplate } from "@/lib/evaluation-templates";
import { getTemplatesByCategory } from "@/lib/evaluation-templates";
import type { SelectedTemplate } from "./types";

interface BuilderContextValue {
	selectedCategory: string;
	setSelectedCategory: (cat: string) => void;
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	selectedTemplates: SelectedTemplate[];
	activeTemplate: string | null;
	setActiveTemplate: (id: string | null) => void;
	activeTab: string;
	setActiveTab: (tab: string) => void;
	evaluationName: string;
	setEvaluationName: (name: string) => void;
	evaluationDescription: string;
	setEvaluationDescription: (desc: string) => void;
	draggedTemplate: EvaluationTemplate | null;
	setDraggedTemplate: (t: EvaluationTemplate | null) => void;
	filteredTemplates: EvaluationTemplate[];
	activeTemplateData: SelectedTemplate | undefined;
	handleAddTemplate: (template: EvaluationTemplate) => void;
	handleRemoveTemplate: (id: string) => void;
	handleUpdateTemplateConfig: (
		id: string,
		config: Partial<SelectedTemplate["config"]>,
	) => void;
	handleOpenSettings: (id: string) => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder(): BuilderContextValue {
	const ctx = useContext(BuilderContext);
	if (!ctx) throw new Error("useBuilder must be used within BuilderProvider");
	return ctx;
}

export function BuilderProvider({ children }: { children: React.ReactNode }) {
	const [selectedCategory, setSelectedCategory] =
		useState<string>("unit_tests");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTemplates, setSelectedTemplates] = useState<
		SelectedTemplate[]
	>([]);
	const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<string>("overview");
	const [evaluationName, setEvaluationName] = useState("");
	const [evaluationDescription, setEvaluationDescription] = useState("");
	const [draggedTemplate, setDraggedTemplate] =
		useState<EvaluationTemplate | null>(null);

	const filteredTemplates = useMemo(
		() =>
			getTemplatesByCategory(selectedCategory).filter(
				(t) =>
					t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					t.description.toLowerCase().includes(searchQuery.toLowerCase()),
			),
		[selectedCategory, searchQuery],
	);

	const activeTemplateData = useMemo(
		() => selectedTemplates.find((t) => t.id === activeTemplate),
		[selectedTemplates, activeTemplate],
	);

	const handleAddTemplate = useCallback((template: EvaluationTemplate) => {
		const newTemplate: SelectedTemplate = {
			id: `${template.id}-${Date.now()}`,
			template,
			config: {},
		};
		setSelectedTemplates((prev) => [...prev, newTemplate]);
		setActiveTemplate(newTemplate.id);
	}, []);

	const handleRemoveTemplate = useCallback((id: string) => {
		setSelectedTemplates((prev) => prev.filter((t) => t.id !== id));
		setActiveTemplate((prev) => (prev === id ? null : prev));
	}, []);

	const handleUpdateTemplateConfig = useCallback(
		(id: string, config: Partial<SelectedTemplate["config"]>) => {
			setSelectedTemplates((prev) =>
				prev.map((t) =>
					t.id === id ? { ...t, config: { ...t.config, ...config } } : t,
				),
			);
		},
		[],
	);

	const handleOpenSettings = useCallback((id: string) => {
		setActiveTemplate(id);
		setActiveTab("overview");
	}, []);

	const value = useMemo<BuilderContextValue>(
		() => ({
			selectedCategory,
			setSelectedCategory,
			searchQuery,
			setSearchQuery,
			selectedTemplates,
			activeTemplate,
			setActiveTemplate,
			activeTab,
			setActiveTab,
			evaluationName,
			setEvaluationName,
			evaluationDescription,
			setEvaluationDescription,
			draggedTemplate,
			setDraggedTemplate,
			filteredTemplates,
			activeTemplateData,
			handleAddTemplate,
			handleRemoveTemplate,
			handleUpdateTemplateConfig,
			handleOpenSettings,
		}),
		[
			selectedCategory,
			searchQuery,
			selectedTemplates,
			activeTemplate,
			activeTab,
			evaluationName,
			evaluationDescription,
			draggedTemplate,
			filteredTemplates,
			activeTemplateData,
			handleAddTemplate,
			handleRemoveTemplate,
			handleUpdateTemplateConfig,
			handleOpenSettings,
		],
	);

	return (
		<BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
	);
}
