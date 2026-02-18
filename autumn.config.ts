import { feature, featureItem, pricedFeatureItem, product } from "atmn";

export const traces = feature({
  id: "traces",
  name: "Traces",
  type: "single_use",
});

export const projects = feature({
  id: "projects",
  name: "Projects",
  type: "continuous_use",
});

export const organizations = feature({
  id: "organizations",
  name: "Organizations",
  type: "continuous_use",
});

export const seats = feature({
  id: "seats",
  name: "Seats",
  type: "continuous_use",
});

export const annotations = feature({
  id: "annotations",
  name: "Annotations",
  type: "single_use",
});

export const tracesPerProject = feature({
  id: "traces_per_project",
  name: "Traces Per Project",
  type: "single_use",
});

export const evalsPerProject = feature({
  id: "evals_per_project",
  name: "Evaluations Per Project",
  type: "single_use",
});

export const annotationsPerProject = feature({
  id: "annotations_per_project",
  name: "Annotation Tasks Per Project",
  type: "single_use",
});

export const workflowsPerProject = feature({
  id: "workflows_per_project",
  name: "Workflows Per Project",
  type: "single_use",
});

export const communitySupport = feature({
  id: "community_support",
  name: "Community Support",
  type: "boolean",
});

export const emailSupport = feature({
  id: "email_support",
  name: "Email Support",
  type: "boolean",
});

export const prioritySupport = feature({
  id: "priority_support",
  name: "Priority Support",
  type: "boolean",
});

export const basicIntegrations = feature({
  id: "basic_integrations",
  name: "Basic Integrations",
  type: "boolean",
});

export const advancedFeatures = feature({
  id: "advanced_features",
  name: "Advanced Features",
  type: "boolean",
});

export const developer = product({
  id: "developer",
  name: "Developer",
  is_default: true,
  items: [
    featureItem({
      feature_id: traces.id,
      included_usage: 10000,
      interval: "month",
    }),
    featureItem({
      feature_id: projects.id,
      included_usage: 3,
    }),
    featureItem({
      feature_id: annotations.id,
      included_usage: 25,
      interval: "month",
    }),
    featureItem({
      feature_id: tracesPerProject.id,
      included_usage: 250,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: evalsPerProject.id,
      included_usage: 25,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: annotationsPerProject.id,
      included_usage: 25,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: workflowsPerProject.id,
      included_usage: 10,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: communitySupport.id,
    }),
  ],
});

export const team = product({
  id: "team",
  name: "Team",
  items: [
    pricedFeatureItem({
      feature_id: seats.id,
      price: 49,
      interval: "month",
    }),
    featureItem({
      feature_id: traces.id,
      included_usage: 25000,
      interval: "month",
    }),
    featureItem({
      feature_id: projects.id,
      included_usage: 5,
    }),
    featureItem({
      feature_id: annotations.id,
      included_usage: 50,
      interval: "month",
    }),
    featureItem({
      feature_id: tracesPerProject.id,
      included_usage: 500,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: evalsPerProject.id,
      included_usage: 50,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: annotationsPerProject.id,
      included_usage: 50,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: workflowsPerProject.id,
      included_usage: 25,
      interval: "month",
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: emailSupport.id,
    }),
    featureItem({
      feature_id: basicIntegrations.id,
    }),
  ],
});

export const professional = product({
  id: "professional",
  name: "Professional",
  items: [
    pricedFeatureItem({
      feature_id: seats.id,
      price: 99,
      interval: "month",
    }),
    featureItem({
      feature_id: traces.id,
      included_usage: 100000,
      interval: "month",
    }),
    featureItem({
      feature_id: projects.id,
    }),
    featureItem({
      feature_id: annotations.id,
    }),
    featureItem({
      feature_id: tracesPerProject.id,
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: evalsPerProject.id,
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: annotationsPerProject.id,
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: workflowsPerProject.id,
      entity_feature_id: organizations.id,
    }),
    featureItem({
      feature_id: prioritySupport.id,
    }),
    featureItem({
      feature_id: advancedFeatures.id,
    }),
  ],
});
