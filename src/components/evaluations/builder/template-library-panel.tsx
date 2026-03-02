"use client";

import { Plus, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEMPLATE_CATEGORIES } from "@/lib/evaluation-templates";
import { useBuilder } from "./builder-context";

export function TemplateLibraryPanel() {
	const {
		selectedCategory,
		setSelectedCategory,
		searchQuery,
		setSearchQuery,
		filteredTemplates,
		handleAddTemplate,
		setDraggedTemplate,
	} = useBuilder();

	return (
		<Card className="w-80 flex flex-col">
			<CardHeader className="pb-3">
				<CardTitle className="text-base flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-primary" />
					Template Library
				</CardTitle>
				<CardDescription className="text-xs">
					Drag templates to the canvas or click to add
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0">
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						aria-label="Search templates"
						placeholder="Search templates..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-8 h-9"
					/>
				</div>

				<Tabs
					value={selectedCategory}
					onValueChange={setSelectedCategory}
					className="flex-1 flex flex-col"
				>
					<TabsList className="grid grid-cols-2 h-auto gap-1 p-1">
						{TEMPLATE_CATEGORIES.slice(0, 4).map((cat) => (
							<TabsTrigger
								key={cat.id}
								value={cat.id}
								className="text-xs py-1.5"
							>
								{cat.name}
							</TabsTrigger>
						))}
					</TabsList>

					<ScrollArea className="flex-1 mt-3">
						<div className="space-y-2 pr-4">
							{filteredTemplates.map((template) => {
								const Icon = template.icon as React.ElementType;
								return (
									<Card
										key={template.id}
										className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
										draggable
										onDragStart={() => setDraggedTemplate(template)}
										onDragEnd={() => setDraggedTemplate(null)}
										onClick={() => handleAddTemplate(template)}
									>
										<CardContent className="p-3">
											<div className="flex items-start gap-2">
												<div className="rounded-md bg-primary/10 p-1.5 flex-shrink-0">
													<Icon className="h-3.5 w-3.5 text-primary" />
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-start justify-between gap-2">
														<h4 className="font-medium text-xs leading-tight">
															{template.name}
														</h4>
														<Plus className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
													</div>
													<p className="text-xs text-muted-foreground line-clamp-2 mt-1">
														{template.description}
													</p>
													<div className="flex items-center gap-1 mt-2">
														<Badge
															variant="outline"
															className="text-xs px-1.5 py-0"
														>
															{template.complexity}
														</Badge>
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					</ScrollArea>
				</Tabs>
			</CardContent>
		</Card>
	);
}
