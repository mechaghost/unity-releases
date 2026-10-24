/** Reviewed feature detail copy and official resources. Stable slugs must not change when headings do. */
export type FeatureDetails = {
  slug: string;
  technicalName: string;
  overview: string[];
  steps: string[];
  notes: string[];
  links: { label: string; url: string }[];
  searchTerms: string[];
  packageId?: string;
};

export const FEATURE_DETAILS: Record<string, FeatureDetails> = {
  "6.6-0": {
    "slug": "2d-lighting-layers",
    "technicalName": "2D Rendering Layers",
    "links": [
      {
        "label": "Create a 2D light in URP",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/urp/2d-light-properties-explained.html"
      },
      {
        "label": "Optimize 2D lights in URP",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/urp/2d-light-batching-debugger.html"
      }
    ],
    "overview": [
      "Rendering layers separate lighting choices from sprite draw order. A character can receive its own lights without moving to a different sorting layer."
    ],
    "steps": [
      "Enable Use Rendering Layers in the URP asset, then assign the target objects to a rendering layer.",
      "Select the 2D light and set its Rendering Layers filter to the matching layer."
    ],
    "notes": [
      "Requires the URP 2D renderer. Global 2D lights and volumetric lights affect all rendering layers."
    ],
    "searchTerms": [
      "Rendering Layers",
      "Light2D"
    ],
    "packageId": "com.unity.render-pipelines.universal"
  },
  "6.6-1": {
    "slug": "compute-light-baker",
    "technicalName": "Unity Compute Light Baker",
    "links": [
      {
        "label": "Graphics Project Settings",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/class-GraphicsSettings.html#light-baker"
      }
    ],
    "overview": [
      "Unity Compute Light Baker produces baked lightmaps and probe data using compute shaders. Hardware ray tracing can accelerate the bake on compatible GPUs."
    ],
    "steps": [
      "Open Project Settings > Graphics and locate Light Baker.",
      "Select Unity Compute Light Baker, then regenerate the lighting data for the scene."
    ],
    "notes": [
      "Bake results can differ from the previous light baker; lighting settings may need adjustment."
    ],
    "searchTerms": [
      "Compute Light Baker",
      "light baking"
    ]
  },
  "6.6-2": {
    "slug": "build-analysis",
    "technicalName": "Build Analysis",
    "links": [
      {
        "label": "Build Analysis window",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/build-analysis-window-reference.html"
      },
      {
        "label": "Build history",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/build-history.html"
      }
    ],
    "overview": [
      "Build Analysis brings saved build reports into one window. It shows build duration, output size, cache reuse, errors, and which assets contribute to the result."
    ],
    "steps": [
      "Build the Player, then open Window > Analysis > Build Analysis and select that build.",
      "Use Overview to inspect slow build steps or failures. Use Assets to find large assets and their references."
    ],
    "notes": [
      "Build history records Player and content-directory builds. BuildPipeline.BuildAssetBundles does not populate this history."
    ],
    "searchTerms": [
      "Build Analysis",
      "BuildHistory"
    ]
  },
  "6.6-3": {
    "slug": "fast-enter-play-mode",
    "technicalName": "Fast Enter Play Mode",
    "links": [
      {
        "label": "Enter Play mode without domain reload",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/domain-reloading.html"
      },
      {
        "label": "Domain reloading issues",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/project-auditor/domain-reloading-issues.html"
      }
    ],
    "overview": [
      "New projects enter Play mode without reloading the code domain. Scene reload remains enabled by default, but static variables and event subscriptions survive between runs."
    ],
    "steps": [
      "Open Project Settings > Editor to inspect the Enter Play Mode settings.",
      "Reset persistent static state explicitly, or use the static-cleanup attributes described in the manual. Project Auditor can flag domain-reload issues."
    ],
    "notes": [
      "Existing projects keep their configured behavior. Code that relies on domain reload to clear state must be updated."
    ],
    "searchTerms": [
      "domain reload",
      "Enter Play Mode"
    ]
  },
  "6.6-4": {
    "slug": "content-directories",
    "technicalName": "Content directories",
    "links": [
      {
        "label": "Introduction to content directories",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/content-directories-introduction.html"
      },
      {
        "label": "Convert Addressables projects to content directories",
        "url": "https://docs.unity3d.com/Packages/com.unity.addressables@4.0/manual/convert-content-directories.html"
      }
    ],
    "overview": [
      "Content directories track dependencies per asset so local content can load in smaller pieces. Addressables can use them while retaining its existing loading API."
    ],
    "steps": [
      "In Addressables, select the local groups to migrate and use Convert Schema(s) to content directories.",
      "Build the content directory and distribute its output with the Player. The conversion guide covers the settings that change."
    ],
    "notes": [
      "Local content only: remote content still needs an appropriate delivery system such as AssetBundles. Separate content builds can still duplicate shared assets."
    ],
    "searchTerms": [
      "content directories",
      "Loadable"
    ],
    "packageId": "com.unity.addressables"
  },
  "6.6-5": {
    "slug": "hierarchy-window",
    "technicalName": "Hierarchy window",
    "links": [
      {
        "label": "Configure the Hierarchy window",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/configure-hierarchy-window.html"
      }
    ],
    "overview": [
      "The new Hierarchy is enabled by default in 6.6. Columns expose object state, layers, and tags beside names, with settings saved per project."
    ],
    "steps": [
      "Right-click a column heading to choose the columns to display.",
      "Drag headers to reorder or resize columns. Use Reset Columns to restore the default arrangement."
    ],
    "notes": [
      "The legacy view remains available under Project Settings > Editor > Use Legacy Hierarchy."
    ],
    "searchTerms": [
      "Hierarchy"
    ]
  },
  "6.6-6": {
    "slug": "gpu-skinned-2d-shadows",
    "technicalName": "2D shadows with GPU skinning",
    "links": [
      {
        "label": "GPU skinning",
        "url": "https://docs.unity3d.com/Packages/com.unity.2d.animation@16.0/manual/GPUDeformation.html"
      }
    ],
    "overview": [
      "Skinned 2D characters can now keep their shadows when deformation runs on the GPU. This removes an earlier tradeoff between GPU skinning and 2D shadow casting."
    ],
    "steps": [
      "Use a URP project with the SRP Batcher enabled and a shader that supports sprite skinning.",
      "Select GPU skinning in Player settings and use a Shadow Caster 2D on the animated sprite."
    ],
    "notes": [
      "Requires URP 2D, the SRP Batcher, and a compatible skinning shader. Android OpenGL ES 3 and WebGL do not support GPU deformation and do not automatically fall back to CPU deformation."
    ],
    "searchTerms": [
      "GPU skinning",
      "Shadow Caster 2D"
    ],
    "packageId": "com.unity.2d.animation"
  },
  "6.6-7": {
    "slug": "2d-profiler-modules",
    "technicalName": "2D Profiler modules",
    "links": [
      {
        "label": "Profiler modules introduction",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/profiler-modules-introduction.html"
      }
    ],
    "overview": [
      "Separate modules expose 2D animation, tilemap, and lighting costs. Sprite Skin statistics distinguish CPU and GPU deformation; tilemap and graphics views show which assets and passes contribute work."
    ],
    "steps": [
      "Open Window > Analysis > Profiler and enable the 2D modules from the module selector.",
      "Record a session, select a costly frame, and inspect its sprite, tilemap, light, or shadow breakdown."
    ],
    "notes": [],
    "searchTerms": [
      "2D Animation Profiler",
      "Tilemap Profiler"
    ]
  },
  "6.6-8": {
    "slug": "frame-debugger",
    "technicalName": "Frame Debugger constant buffers",
    "links": [
      {
        "label": "Frame Debugger Event Information reference",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/frame-debugger-window-event-information.html"
      }
    ],
    "overview": [
      "Frame Debugger now exposes names and values inside shader constant buffers. This helps trace an unexpected material result back to the data submitted for a particular draw."
    ],
    "steps": [
      "Capture a frame in Frame Debugger and select the draw event that produces the affected object.",
      "Open Constant Buffers in Event Information and compare the submitted values with the material or script values you intended."
    ],
    "notes": [],
    "searchTerms": [
      "Frame Debugger",
      "constant buffers"
    ]
  },
  "6.6-9": {
    "slug": "shader-compilation",
    "technicalName": "DXC shader compilation",
    "links": [
      {
        "label": "Compile shaders with the DirectX 12 compiler",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/shader-dxc-compiler.html"
      },
      {
        "label": "Reduce shader variants",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/shader-variant-stripping.html"
      }
    ],
    "overview": [
      "Build profiles can select DXC for DirectX 12 shaders. DXC enables Shader Model 6 capabilities and improves compatibility with modern GPU inspection tools."
    ],
    "steps": [
      "Open a Windows Build Profile and add Graphics Settings.",
      "Under Shader Build Settings, add a compiler selection for Direct3D12 and choose DirectX 12 Compiler (DXC)."
    ],
    "notes": [
      "DXC does not support DirectX 11. Building for both DX11 and DX12 creates separate shader sets. Vulkan and Metal DXC support is experimental in this release."
    ],
    "searchTerms": [
      "DXC",
      "Shader Build Settings"
    ]
  },
  "6.6-10": {
    "slug": "safe-area",
    "technicalName": "uGUI Safe Area",
    "links": [
      {
        "label": "Safe Area",
        "url": "https://docs.unity3d.com/Packages/com.unity.ugui@2.6/manual/script-SafeArea.html"
      }
    ],
    "overview": [
      "The Safe Area component adjusts a uGUI container when a device reports cutouts, rounded edges, or gesture regions. Child controls follow the container as the screen rotates."
    ],
    "steps": [
      "Add Safe Area to a dedicated RectTransform below the Canvas and place essential controls inside it.",
      "Choose the reference orientation and edges to inset. Leave full-screen background artwork outside this container."
    ],
    "notes": [
      "Safe Area drives anchors and offsets. Do not attach another layout controller that drives the same RectTransform."
    ],
    "searchTerms": [
      "SafeArea",
      "uGUI"
    ],
    "packageId": "com.unity.ugui"
  },
  "6.6-11": {
    "slug": "backdrop-filters",
    "technicalName": "UI Toolkit backdrop filters",
    "links": [
      {
        "label": "Apply effects behind elements with backdrop filters",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/ui-systems/backdrop-filter.html"
      }
    ],
    "overview": [
      "The backdrop-filter style processes the content behind a UI element. It can create a blurred panel while keeping the panel’s own text and controls sharp."
    ],
    "steps": [
      "Apply backdrop-filter to the UI Toolkit element that should sit above the blurred content.",
      "Use the manual’s USS examples to choose the filter and tune the effect within the element bounds."
    ],
    "notes": [
      "Requires URP and a screen-space panel. Built-in rendering, HDRP, world-space panels, and USS transitions are not supported for this property."
    ],
    "searchTerms": [
      "backdrop-filter",
      "UI Toolkit"
    ]
  },
  "6.6-12": {
    "slug": "ui-drop-shadows",
    "technicalName": "UI Toolkit drop shadows",
    "links": [
      {
        "label": "Apply common effects with built-in filters",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/ui-systems/built-in-filters.html"
      }
    ],
    "overview": [
      "UI Toolkit’s drop-shadow filter creates a shadow from an element’s rendered content. The same filter system can combine blur, tint, and other effects."
    ],
    "steps": [
      "In UI Builder, select the element and add a filter under Inline Styles > Filter.",
      "Choose drop-shadow and set its offset, blur radius, and color, or define the equivalent filter in USS."
    ],
    "notes": [
      "Filters run in order on the rendered element subtree. Multiple style classes do not automatically merge separate filter declarations."
    ],
    "searchTerms": [
      "drop-shadow",
      "UI Toolkit"
    ]
  },
  "6.6-13": {
    "slug": "ui-mesh-modifiers",
    "technicalName": "UI Toolkit mesh modifiers",
    "links": [
      {
        "label": "UIElements.VisualElement.AddMeshModifier",
        "url": "https://docs.unity3d.com/6000.6/Documentation/ScriptReference/UIElements.VisualElement.AddMeshModifier.html"
      },
      {
        "label": "Custom vertex data",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/ui-systems/custom-vertex-data.html"
      }
    ],
    "overview": [
      "A mesh modifier receives an element’s generated geometry before it is sent to the GPU. Custom vertex channels can supply additional data to a UI shader."
    ],
    "steps": [
      "Register a callback with VisualElement.AddMeshModifier to change the generated mesh.",
      "If the shader needs extra inputs, enable the matching channels on Panel Settings and populate them during mesh generation."
    ],
    "notes": [
      "Requires custom code. Extra channels consume additional GPU memory per vertex, and supplied arrays must remain valid until rendering flushes."
    ],
    "searchTerms": [
      "AddMeshModifier",
      "UI Toolkit"
    ]
  },
  "6.6-14": {
    "slug": "graph-debugging",
    "technicalName": "Graph Toolkit debugging",
    "links": [
      {
        "label": "GraphMotion",
        "url": "https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Unity.GraphToolkit.Editor.GraphVisualization.GraphMotion.html"
      },
      {
        "label": "GraphLogger",
        "url": "https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Unity.GraphToolkit.Editor.GraphLogger.html"
      }
    ],
    "overview": [
      "Graph tools can display running nodes, animated connections, data previews, and messages on the graph itself. The tool’s runtime implementation supplies the execution information."
    ],
    "steps": [
      "Connect graph element identifiers to a GraphVisualization context in your custom tool.",
      "Use GraphMotion to show activity and GraphLogger to associate warnings or errors with graph elements."
    ],
    "notes": [
      "This is tooling for custom Editor graphs, not an automatic runtime for graph logic. GraphLogger Console output requires the graph editor to be open."
    ],
    "searchTerms": [
      "Graph Toolkit",
      "GraphMotion"
    ]
  },
  "6.6-15": {
    "slug": "signed-asset-packages",
    "technicalName": "Asset package signatures",
    "links": [
      {
        "label": "Package signatures in asset packages",
        "url": "https://docs.unity3d.com/6000.6/Documentation/Manual/AssetPackagesSignatures.html"
      }
    ],
    "overview": [
      "Unity checks signatures when importing exported .unitypackage files. The signature identifies the publishing organization and helps detect changes made after export."
    ],
    "steps": [
      "When exporting an asset package, sign in to the Editor and select the organization associated with the package.",
      "When importing, inspect the displayed publisher and signature status before choosing which assets to bring in."
    ],
    "notes": [
      "Signing requires an internet connection. Older Editors can import these packages but do not verify their signatures."
    ],
    "searchTerms": [
      "asset package signatures",
      "unitypackage"
    ]
  },
  "6.5-0": {
    "slug": "custom-2d-lights-shadows",
    "technicalName": "Custom 2D lights and shadows",
    "links": [
      {
        "label": "Create a custom 2D light type",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/unity2d/2d-urp/2d-index/custom-2d-light"
      },
      {
        "label": "Create a custom 2D shadow",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/unity2d/2d-urp/2d-index/2d-shadows/custom-2d-shadow"
      }
    ],
    "overview": [
      "Custom providers let programmers define new light and shadow shapes that artists can then adjust in the Inspector. They extend the existing URP 2D components."
    ],
    "steps": [
      "Create a Light2DProvider with a name and mesh, or a ShadowShape2DProvider that supplies a shadow shape.",
      "Select the new provider in the Light Type or Shadow Caster 2D Casting Source field."
    ],
    "notes": [
      "Requires the URP 2D renderer and C# provider code. A static shadow can initialize its shape once instead of updating before every render."
    ],
    "searchTerms": [
      "Light2DProvider",
      "ShadowShape2DProvider"
    ],
    "packageId": "com.unity.render-pipelines.universal"
  },
  "6.5-1": {
    "slug": "2d-profiler",
    "technicalName": "2D Profiler",
    "links": [
      {
        "label": "2D Profiler module reference",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/unity2d/sprite/profiler-2d"
      }
    ],
    "overview": [
      "The 2D module separates loaded sprites and atlases from those actually rendered. Its detail table exposes atlas pages and texture usage to help find wasted texture space."
    ],
    "steps": [
      "Open Window > Analysis > Profiler, then enable 2D from Profiler Modules.",
      "Select a frame and inspect the sprite, atlas, page-count, and Usage columns in the details pane."
    ],
    "notes": [
      "Loaded counts include culled or unused content. Rendered counts describe what was drawn in that frame."
    ],
    "searchTerms": [
      "2D Profiler",
      "SpriteAtlas"
    ]
  },
  "6.5-2": {
    "slug": "physics-core-2d",
    "technicalName": "Physics Core 2D and RenderSprite",
    "links": [
      {
        "label": "2D physics with the Physics Core 2D API",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/unity2d/2d-physics-api"
      },
      {
        "label": "RenderSprite",
        "url": "https://docs.unity.com/en-us/engine/6000.5/script-reference/unityengine/graphics/rendersprite"
      }
    ],
    "overview": [
      "Physics Core 2D provides a C#-driven physics world. RenderSprite draws sprites without creating a GameObject for each one, making a different approach to large simulations possible."
    ],
    "steps": [
      "Use the Physics Core 2D guide to create and step a world with bodies and shapes.",
      "Submit the visual results through Graphics.RenderSprite or RenderSpriteInstanced each frame."
    ],
    "notes": [
      "This is a code-driven workflow rather than Rigidbody2D component setup. RenderSprite supports 2D lights and masks but does not cast shadows in this release."
    ],
    "searchTerms": [
      "Physics Core 2D",
      "RenderSprite"
    ]
  },
  "6.5-3": {
    "slug": "tile-only-rendering",
    "technicalName": "Tile-Only rendering",
    "links": [
      {
        "label": "Improve performance with on-tile rendering",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/analysis/graphics-performance-profiling/in-urp/on-tile-rendering"
      },
      {
        "label": "On-tile post-processing",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/post-processing-and-full-screen-effects/urp/on-tile-post-processing"
      }
    ],
    "overview": [
      "Tile-Only mode validates rendering settings so supported effects can remain in fast GPU tile memory. Avoiding extra stores and loads can reduce bandwidth and power use."
    ],
    "steps": [
      "Use a URP renderer with Tile-Only rendering and resolve the validation messages for camera and renderer settings.",
      "Add the on-tile post-processing renderer feature for supported effects, with integrated URP post-processing disabled."
    ],
    "notes": [
      "Bandwidth savings require a tile-based GPU and an API with native render passes. Features that sample camera textures can break the on-tile path; WebGL is unsupported."
    ],
    "searchTerms": [
      "Tile-Only",
      "on-tile"
    ],
    "packageId": "com.unity.render-pipelines.universal"
  },
  "6.5-4": {
    "slug": "tilemap-entity-ids",
    "technicalName": "Tilemap Entity IDs",
    "links": [
      {
        "label": "Unity 6.5 2D changes",
        "url": "https://discussions.unity.com/t/unity-6-5-is-now-available/1723176"
      }
    ],
    "overview": [
      "Tilemaps can use Entity IDs when setting tiles. This targets the cost of updating tile data rather than changing the way artists paint a level."
    ],
    "steps": [
      "Use the Entity ID tile workflow for code that frequently replaces or fills tiles.",
      "Compare the tile-setting workload in the Profiler before and after changing that code."
    ],
    "notes": [],
    "searchTerms": [
      "Tilemap",
      "EntityId"
    ]
  },
  "6.5-5": {
    "slug": "sprite-blend-shapes",
    "technicalName": "Sprite blend shapes",
    "links": [
      {
        "label": "Sprite.AddBlendShape",
        "url": "https://docs.unity.com/en-us/engine/6000.5/script-reference/unityengine/sprite/addblendshape"
      }
    ],
    "overview": [
      "Sprite blend-shape APIs provide a way to deform a sprite beyond a bone rig. Tool authors can expose shape controls for expressions or other custom animation."
    ],
    "steps": [
      "Create a uniquely named shape with Sprite.AddBlendShape.",
      "Build the deformation and animation controls around the sprite blend-shape APIs for the tool or character system."
    ],
    "notes": [
      "This is an API foundation, not a ready-made character animation editor. Empty or duplicate shape names are rejected."
    ],
    "searchTerms": [
      "Sprite blend shape",
      "AddBlendShape"
    ]
  },
  "6.5-6": {
    "slug": "shader-subgraphs",
    "technicalName": "Shader Graph subgraph improvements",
    "links": [
      {
        "label": "Subgraph changes and examples",
        "url": "https://discussions.unity.com/t/shader-subgraph-improvements-in-unity-6-5/1705859"
      }
    ],
    "overview": [
      "Subgraph inputs gain clearer editing controls, including colors, integer fields, sliders, and enums. A Switch node can follow an enum input’s choices."
    ],
    "steps": [
      "Select a subgraph input and choose the inline control and constraints that fit its value.",
      "Use an enum-driven Switch node for alternative branches, or disable an input connector when the value must remain constant."
    ],
    "notes": [
      "Inline constraints govern constant editing. Connected values still need any required validation inside the graph."
    ],
    "searchTerms": [
      "Shader Graph",
      "Subgraph"
    ],
    "packageId": "com.unity.shadergraph"
  },
  "6.5-7": {
    "slug": "lighting-search",
    "technicalName": "Lighting Search",
    "links": [
      {
        "label": "Lighting Search window",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/lighting-overview/lighting-explorer"
      }
    ],
    "overview": [
      "Lighting Search gathers lighting-related objects into a searchable table. Saved filters and batch editing help maintain consistent settings across a scene."
    ],
    "steps": [
      "Open Lighting Search and narrow the results to the lighting objects or properties you need.",
      "Inspect or edit the matching rows together, then save the search for repeated work."
    ],
    "notes": [],
    "searchTerms": [
      "Lighting Search"
    ]
  },
  "6.5-8": {
    "slug": "graph-customization",
    "technicalName": "Graph Toolkit customization",
    "links": [
      {
        "label": "the Dungeon Graph Generator documentation",
        "url": "https://docs.unity3d.com/Packages/com.unity.graphtoolkit-samples@0.6/manual/dungeon-graph-generator-introduction.html"
      }
    ],
    "overview": [
      "Graph Toolkit adds programmatic graph creation and more control over data types and styling. The Dungeon Graph Generator sample demonstrates turning generation rules into an editable graph."
    ],
    "steps": [
      "Open the Dungeon Graph Generator sample to inspect how its generator creates nodes and connections.",
      "Adapt the graph construction and visual customization code to your own Editor tool."
    ],
    "notes": [
      "Graph assets are Editor-only. A game needs its own conversion or runtime representation to execute their meaning."
    ],
    "searchTerms": [
      "Graph Toolkit",
      "graph customization"
    ]
  },
  "6.5-9": {
    "slug": "android-build-optimization",
    "technicalName": "Android ThinLTO and IL2CPP Master",
    "links": [
      {
        "label": "Android optimization setup and results",
        "url": "https://discussions.unity.com/t/boosting-android-performance-with-lto-optimizations-in-unity-6-5/1720008"
      },
      {
        "label": "Android build settings reference",
        "url": "https://docs.unity.com/en-us/engine/6000.5/manual/platform-specific/android/building-and-delivering/build-settings"
      }
    ],
    "overview": [
      "ThinLTO optimizes the Android engine library at link time. IL2CPP Master configuration adds a separate set of runtime optimizations for production builds."
    ],
    "steps": [
      "Disable Strip Engine Code, then set Link Time Optimization to Thin in the Android Build Profile.",
      "Choose IL2CPP Master configuration and compare startup, scene loading, and CPU frame times on the target device."
    ],
    "notes": [
      "ThinLTO requires Strip Engine Code to be disabled. IL2CPP Master increases build time; published performance gains are not a guarantee for every project."
    ],
    "searchTerms": [
      "Android",
      "ThinLTO"
    ]
  },
  "6.5-10": {
    "slug": "package-samples",
    "technicalName": "Package Manager All Samples",
    "links": [
      {
        "label": "All Samples release announcement",
        "url": "https://discussions.unity.com/t/unity-6-5-is-now-available/1723176"
      }
    ],
    "overview": [
      "All Samples lists examples from installed packages, including dependencies. The view includes descriptions, previews, and the package each sample belongs to."
    ],
    "steps": [
      "Open Package Manager and select All Samples.",
      "Search or filter the examples, inspect a sample’s description, and import the one needed for the feature you are trying."
    ],
    "notes": [
      "The view shows samples supplied by installed packages; it is not a search of every Asset Store example."
    ],
    "searchTerms": [
      "Package Manager",
      "Samples"
    ]
  },
  "6.4-0": {
    "slug": "built-in-project-auditor",
    "technicalName": "Built-in Project Auditor",
    "links": [
      {
        "label": "Project Auditor",
        "url": "https://docs.unity3d.com/6000.4/Documentation/Manual/project-auditor/project-auditor.html"
      }
    ],
    "overview": [
      "Project Auditor is included in the Editor instead of needing a separate tool installation. It analyzes code, assets, and settings and groups findings into a report."
    ],
    "steps": [
      "Open Window > Analysis > Project Auditor and analyze the project.",
      "Open a finding to inspect the affected asset, setting, or code location. The rules package can update separately from the Editor."
    ],
    "notes": [
      "Static analysis identifies potential issues; it does not replace a runtime performance capture."
    ],
    "searchTerms": [
      "Project Auditor"
    ],
    "packageId": "com.unity.project-auditor-rules"
  },
  "6.4-1": {
    "slug": "package-signature-warnings",
    "technicalName": "Package signature warnings",
    "links": [
      {
        "label": "Package signature checks",
        "url": "https://docs.unity3d.com/6000.4/Documentation/Manual/upm-signature.html"
      }
    ],
    "overview": [
      "Package Manager makes unsigned and externally published packages more visible before installation. The check helps identify package origin and integrity."
    ],
    "steps": [
      "Inspect the publisher and signature information in the installation prompt.",
      "Use the package-signature guide to distinguish a missing signature from a signature that cannot be verified."
    ],
    "notes": [
      "A signature identifies origin and integrity; it does not certify that package code is suitable for your project."
    ],
    "searchTerms": [
      "package signature",
      "Package Manager"
    ]
  },
  "6.4-2": {
    "slug": "console-adaptive-performance",
    "technicalName": "Adaptive Performance basic provider",
    "links": [
      {
        "label": "Basic provider",
        "url": "https://docs.unity3d.com/6000.4/Documentation/Manual/adaptive-performance/basic-provider.html"
      },
      {
        "label": "Adaptive Performance provider settings reference",
        "url": "https://docs.unity3d.com/6000.4/Documentation/Manual/adaptive-performance/provider-settings-reference.html"
      }
    ],
    "overview": [
      "The built-in Basic provider now covers PlayStation and Xbox targets. It uses frame timing to inform Adaptive Performance quality adjustments."
    ],
    "steps": [
      "Enable the Basic provider in Adaptive Performance settings.",
      "Configure the Indexer and scaler profiles under Project Settings > Adaptive Performance to define which quality settings may change."
    ],
    "notes": [
      "The Basic provider does not expose thermal status. GPU timing support depends on the graphics API."
    ],
    "searchTerms": [
      "Adaptive Performance",
      "Basic Provider"
    ],
    "packageId": "com.unity.adaptiveperformance"
  },
  "6.4-3": {
    "slug": "matchmaker-reports",
    "technicalName": "Matchmaker reports",
    "links": [
      {
        "label": "Matchmaker documentation",
        "url": "https://docs.unity.com/ugs/en-us/manual/matchmaker/manual/matchmaker-overview"
      }
    ],
    "overview": [
      "Matchmaker adds better visibility into ticket activity and unmatched players. Reports can explain why a ticket did not satisfy a pool’s matching conditions."
    ],
    "steps": [
      "Open the project’s Matchmaker area in Unity Dashboard and inspect the affected ticket or matching report.",
      "Compare the unmet criteria with the pool and rule configuration; use logs to follow creation, matching, allocation, and backfill activity."
    ],
    "notes": [
      "Requires the separate Unity Matchmaker service and access to the project’s Dashboard. These service changes are not an offline Editor feature."
    ],
    "searchTerms": [
      "Matchmaker",
      "matchmaking"
    ],
    "packageId": "com.unity.services.multiplayer"
  },
  "6.4-4": {
    "slug": "ecs-core-packages",
    "technicalName": "ECS core packages",
    "links": [
      {
        "label": "Core packages",
        "url": "https://docs.unity3d.com/6000.4/Documentation/Manual/pack-core.html"
      },
      {
        "label": "ECS for Unity",
        "url": "https://unity.com/ecs"
      }
    ],
    "overview": [
      "Entities and related ECS packages ship with the Editor as core packages. Their versions follow the Editor rather than being independently selected through Package Manager."
    ],
    "steps": [
      "Use the Entities documentation that matches Unity 6.4 when setting up ECS systems.",
      "Inspect the core package list for Entities, Collections, and Entities Graphics and their bundled documentation."
    ],
    "notes": [
      "This changes packaging and version ownership. It does not automatically convert existing GameObjects into ECS systems."
    ],
    "searchTerms": [
      "Entities",
      "ECS"
    ],
    "packageId": "com.unity.entities"
  },
  "6.3-0": {
    "slug": "platform-toolkit",
    "technicalName": "Platform Toolkit",
    "links": [
      {
        "label": "Platform Toolkit 1.0 manual",
        "url": "https://docs.unity3d.com/Packages/com.unity.platformtoolkit@1.0/manual/index.html"
      }
    ],
    "overview": [
      "Platform Toolkit offers one asynchronous API for common platform services such as player accounts, saves, controller ownership, and achievements. Editor testing can exercise those workflows before building to a device."
    ],
    "steps": [
      "Install the Platform Toolkit core package and the support package for the intended platform.",
      "Use the toolkit’s account, storage, or achievement workflow and its Editor test controls before integrating the target platform implementation."
    ],
    "notes": [
      "Platform support and access requirements differ by target. Console deployment still requires the relevant platform authorization and tools."
    ],
    "searchTerms": [
      "Platform Toolkit"
    ],
    "packageId": "com.unity.platformtoolkit"
  },
  "6.3-1": {
    "slug": "profiler-highlights",
    "technicalName": "Highlights Profiler module",
    "links": [
      {
        "label": "Highlights Profiler module reference",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerHighlights.html"
      },
      {
        "label": "Profiler window reference",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerWindow.html#captures-list"
      }
    ],
    "overview": [
      "Highlights compares captured frames with a target frame time. CPU and GPU markers help narrow whether the next investigation belongs in script execution, rendering, or another workload."
    ],
    "steps": [
      "Enable Highlights in the Profiler module selector and choose the target frame rate.",
      "Select one frame or a range to inspect the statistics, then use the detailed Profiler modules to investigate the expensive work."
    ],
    "notes": [
      "The module is not enabled by default. A target frame time is an analysis threshold, not a setting that changes game performance."
    ],
    "searchTerms": [
      "Profiler Highlights"
    ]
  },
  "6.3-2": {
    "slug": "sprite-atlas-analyzer",
    "technicalName": "Sprite Atlas Analyzer",
    "links": [
      {
        "label": "Sprite Atlas Analyzer setup",
        "url": "https://docs.unity3d.com/Packages/com.unity.2d.tooling@1.0/manual/GetStarted-sprite-atlas-analyzer.html"
      }
    ],
    "overview": [
      "Sprite Atlas Analyzer reports wasted texture space, page counts, compression, and sprite counts. It can reveal an atlas that is large in memory while only a small part is useful."
    ],
    "steps": [
      "Install the 2D Tooling package, then open Window > Analysis > Sprite Atlas Analyzer.",
      "Run Analyze and inspect the built-in reports, including Texture Space Wastage and Atlas Page Count."
    ],
    "notes": [
      "Compressed source textures can be compressed again when packed, reducing image quality. Atlases with mismatched secondary textures can waste space."
    ],
    "searchTerms": [
      "Sprite Atlas Analyzer"
    ],
    "packageId": "com.unity.2d.tooling"
  },
  "6.3-3": {
    "slug": "on-tile-post-processing",
    "technicalName": "On-tile post-processing",
    "links": [
      {
        "label": "On-tile post-processing setup",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/xr-graphics-on-tile-post-processing.html"
      }
    ],
    "overview": [
      "The on-tile renderer feature lets supported effects run before a GPU tile is stored in main memory. The 6.3 workflow targets untethered XR."
    ],
    "steps": [
      "Use URP with Vulkan and disable integrated URP post-processing.",
      "Add the on-tile post-processing renderer feature, then configure supported effects such as color grading, vignette, and tonemapping."
    ],
    "notes": [
      "This 6.3 workflow is for untethered XR on compatible tile-based GPUs. Broader mobile support arrives in 6.5. Not all post-processing effects support the on-tile path."
    ],
    "searchTerms": [
      "on-tile post-processing",
      "XR"
    ],
    "packageId": "com.unity.render-pipelines.universal"
  },
  "6.3-4": {
    "slug": "shader-build-settings",
    "technicalName": "Shader Build Settings",
    "links": [
      {
        "label": "Shader Build Settings",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/class-GraphicsSettings.html#shader-build-settings"
      },
      {
        "label": "Reduce shader variants",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/shader-variant-stripping.html"
      }
    ],
    "overview": [
      "Shader Build Settings let a project change how keyword sets produce variants. Teams can strip unused combinations or use dynamic branching without rewriting every shader."
    ],
    "steps": [
      "Open Project Settings > Graphics > Shader Build Settings and add the complete keyword set to override.",
      "Choose the override type or disable unneeded keywords. Use strict shader variant matching to find variants removed by mistake."
    ],
    "notes": [
      "Removing a keyword can strip a variant needed at runtime. Dynamic branching reduces compiled variants but changes work performed by the GPU."
    ],
    "searchTerms": [
      "Shader Build Settings",
      "shader variants"
    ]
  },
  "6.3-5": {
    "slug": "http2",
    "technicalName": "UnityWebRequest HTTP/2",
    "links": [
      {
        "label": "UnityWebRequest",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/web-request.html"
      },
      {
        "label": "Unity 6.3 HTTP/2 announcement",
        "url": "https://unity.com/blog/unity-6-3-lts-is-now-available"
      }
    ],
    "overview": [
      "UnityWebRequest uses HTTP/2 when the server supports it. The update concerns the network connection used for requests, so existing request code can benefit without a new gameplay API."
    ],
    "steps": [
      "Use UnityWebRequest for the request and connect to an endpoint configured for HTTP/2.",
      "Inspect server or network logs to confirm the negotiated protocol and compare concurrent-request behavior."
    ],
    "notes": [
      "The server must support HTTP/2. This does not mean every request becomes faster or that a gRPC client is configured automatically."
    ],
    "searchTerms": [
      "HTTP/2",
      "UnityWebRequest"
    ]
  },
  "6.3-6": {
    "slug": "terrain-shader-graph",
    "technicalName": "Terrain Shader Graph",
    "links": [
      {
        "label": "custom terrain shaders and materials",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/terrain-shader-graph.html"
      },
      {
        "label": "Terrain Shaders sample",
        "url": "https://docs.unity3d.com/Packages/com.unity.shadergraph@17.3/manual/Shader-Graph-Sample-Terrain.html"
      }
    ],
    "overview": [
      "Terrain can use materials authored in Shader Graph. Terrain-specific nodes and templates expose terrain layers while allowing custom surface effects."
    ],
    "steps": [
      "Create a graph from the terrain template for the project’s render pipeline.",
      "Create a material from that graph and assign it to the terrain. Use the Terrain Shaders sample for concrete material examples."
    ],
    "notes": [
      "Choose the template for URP or HDRP; material targets are not interchangeable between render pipelines."
    ],
    "searchTerms": [
      "Terrain Shader Graph"
    ],
    "packageId": "com.unity.shadergraph"
  },
  "6.3-7": {
    "slug": "svg-interfaces",
    "technicalName": "UI Toolkit SVG support",
    "links": [
      {
        "label": "Work with vector graphics",
        "url": "https://docs.unity3d.com/6000.3/Documentation/Manual/ui-systems/work-with-vector-graphics.html"
      }
    ],
    "overview": [
      "UI Toolkit can import SVG content directly as vector graphics. Icons and illustrations can scale without relying on a separate bitmap for each size."
    ],
    "steps": [
      "Import an SVG and set Generated Asset Type to UI Toolkit Vector Image in the Inspector.",
      "Assign the vector image to a UI Toolkit element in UI Builder or through styling."
    ],
    "notes": [
      "The SVG importer supports a subset of SVG 1.1. Text elements, per-pixel masks, filter effects, interactivity, and animations are unsupported."
    ],
    "searchTerms": [
      "SVG",
      "Vector Image"
    ]
  },
  "6.2-0": {
    "slug": "mesh-lod",
    "technicalName": "Mesh LOD",
    "links": [
      {
        "label": "Mesh LOD workflow",
        "url": "https://docs.unity3d.com/6000.2/Documentation/Manual/lod/mesh-lod-introduction.html"
      }
    ],
    "overview": [
      "Mesh LOD generates reduced-detail mesh data during import. Unity can use less geometry when an object occupies less of the screen, without requiring separately authored mesh files for each level."
    ],
    "steps": [
      "Select a supported imported model and configure its Mesh LOD import settings.",
      "Inspect the generated levels and adjust the quality settings for the object’s appearance at different distances."
    ],
    "notes": [
      "In 6.2, Entities Graphics, particle systems, VFX Graph, static batching, and GPU instancing do not automatically select Mesh LODs. Skinned meshes still deform LOD0, so lower rendered detail does not reduce skinning work."
    ],
    "searchTerms": [
      "Mesh LOD"
    ]
  },
  "6.2-1": {
    "slug": "world-space-ui",
    "technicalName": "UI Toolkit world-space UI",
    "links": [
      {
        "label": "Create world-space UI",
        "url": "https://docs.unity3d.com/6000.2/Documentation/Manual/ui-systems/create-world-space-ui.html"
      }
    ],
    "overview": [
      "UI Toolkit panels can render as objects inside a 3D scene instead of being fixed to the screen. This supports in-world menus, displays, and XR interfaces."
    ],
    "steps": [
      "Set the Panel Settings asset’s Render Mode to World Space and choose its Pixels Per Unit.",
      "Set the UI Document’s size mode and pivot, position it in the scene, and configure panel input.",
      "Add GameObject > UI Toolkit > Panel Input Configuration to configure pointer interaction."
    ],
    "notes": [
      "World-space UI does not integrate with 2D sorting layers in this release. Root documents sort by distance from the camera."
    ],
    "searchTerms": [
      "world space UI",
      "UI Toolkit"
    ]
  },
  "6.2-2": {
    "slug": "android-xr",
    "technicalName": "OpenXR: Android XR",
    "links": [
      {
        "label": "Android XR release capabilities",
        "url": "https://discussions.unity.com/t/6-2-is-now-available/1677060"
      },
      {
        "label": "Android XR developer examples",
        "url": "https://unity.com/blog/porting-apps-games-over-android-xr-unity-6"
      }
    ],
    "overview": [
      "The Android XR package reaches verified status with 6.2. The release adds hand meshes, dynamic refresh rate support, and visibility-mesh optimizations for post-processing."
    ],
    "steps": [
      "Configure an Android XR project using the matching OpenXR: Android XR package.",
      "Enable the needed XR capabilities and use the platform guide to build and run on supported hardware."
    ],
    "notes": [
      "Verified package status applies to the release’s supported configuration. Device features still depend on hardware and enabled OpenXR features."
    ],
    "searchTerms": [
      "Android XR"
    ],
    "packageId": "com.unity.xr.androidxr-openxr"
  },
  "6.2-3": {
    "slug": "unity-ai",
    "technicalName": "Unity AI beta",
    "links": [
      {
        "label": "AI tools integrated in the Unity Editor",
        "url": "https://docs.unity3d.com/6000.2/Documentation/Manual/ai-menu.html"
      }
    ],
    "overview": [
      "Unity AI offers optional assistance and generation tools inside the Editor. These tools are available in beta alongside the Unity 6.2 release, with separate installation and organization controls."
    ],
    "steps": [
      "Use the AI menu to install and open the relevant assistance or generation tool.",
      "Review the organization’s AI availability and data-sharing settings before connecting project context to the tool."
    ],
    "notes": [
      "Beta at launch; tools are installed separately. Availability, usage limits, and pricing can change independently of the Editor version."
    ],
    "searchTerms": [
      "Unity AI"
    ],
    "packageId": "com.unity.ai.assistant"
  },
  "6.2-4": {
    "slug": "graph-toolkit",
    "technicalName": "Graph Toolkit",
    "links": [
      {
        "label": "Graph Toolkit setup and samples",
        "url": "https://discussions.unity.com/t/unity-s-graph-toolkit-experimental-available-today-in-unity-6-2/1664909"
      }
    ],
    "overview": [
      "Graph Toolkit is a framework for custom Editor graph tools. It supplies graph authoring pieces while your code defines the nodes, data model, and meaning of the graph."
    ],
    "steps": [
      "Install the experimental Graph Toolkit package using the announcement’s setup instructions.",
      "Start from a sample, define the graph’s node types, and implement how its saved data is used by your tool."
    ],
    "notes": [
      "Experimental in Unity 6.2 and installed separately. Your code must define how the saved graph data is used at runtime."
    ],
    "searchTerms": [
      "Graph Toolkit"
    ],
    "packageId": "com.unity.graphtoolkit"
  },
  "6.2-5": {
    "slug": "diagnostics",
    "technicalName": "Unity Diagnostics",
    "links": [
      {
        "label": "Diagnostics",
        "url": "https://docs.unity.com/en-us/cloud/developer-data/diagnostics"
      }
    ],
    "overview": [
      "Diagnostics groups crashes and failures in Unity Dashboard. Android application-not-responding reports add information about freezes that may not produce a normal crash."
    ],
    "steps": [
      "Open Diagnostics for the project in Unity Dashboard.",
      "Select an issue to inspect affected users, devices, and sessions, then follow the linked diagnostic information to investigate it."
    ],
    "notes": [
      "Reports depend on diagnostic data collection and platform support. Data-sharing controls are separate from fixing an individual issue."
    ],
    "searchTerms": [
      "Diagnostics",
      "ANR"
    ]
  },
  "6.2-6": {
    "slug": "developer-data",
    "technicalName": "Developer Data framework",
    "links": [
      {
        "label": "Developer Data framework",
        "url": "https://docs.unity.com/en-us/cloud/developer-data-framework"
      }
    ],
    "overview": [
      "Developer Data settings provide controls for how Unity uses data collected through its products. Project diagnostics and optional AI-related sharing have distinct settings."
    ],
    "steps": [
      "Open the organization or project’s Developer Data settings in Unity Dashboard.",
      "Review each sharing purpose separately; use Editor Project Settings for diagnostic collection controls."
    ],
    "notes": [
      "Turning off future sharing does not retroactively undo model improvements already made from previously shared AI queries."
    ],
    "searchTerms": [
      "Developer Data"
    ]
  },
  "6.1-0": {
    "slug": "deferred-plus",
    "technicalName": "URP Deferred+",
    "links": [
      {
        "label": "Deferred+ rendering paths in URP",
        "url": "https://docs.unity3d.com/6000.1/Documentation/Manual/urp/rendering/deferred-rendering-path-landing.html"
      }
    ],
    "overview": [
      "Deferred+ combines deferred rendering with clustered light handling. It expands the lighting options for URP scenes with many lights."
    ],
    "steps": [
      "Open the Universal Renderer used by the active URP asset.",
      "Select Deferred+ as the rendering path, then inspect the scene using its intended lights and materials."
    ],
    "notes": [
      "Requires URP. Rendering paths have different hardware and feature support; use the path comparison in the manual for target-platform constraints."
    ],
    "searchTerms": [
      "Deferred+"
    ],
    "packageId": "com.unity.render-pipelines.universal"
  },
  "6.1-1": {
    "slug": "project-auditor",
    "technicalName": "Project Auditor package",
    "links": [
      {
        "label": "Project Auditor package",
        "url": "https://docs.unity3d.com/Packages/com.unity.project-auditor@1.0/manual/index.html"
      }
    ],
    "overview": [
      "Project Auditor is available as a package for inspecting code, assets, and project settings. Findings link analysis results to the places that need attention."
    ],
    "steps": [
      "Install Project Auditor through Package Manager.",
      "Open the Project Auditor window, run its analysis, and inspect the reports for affected code and assets."
    ],
    "notes": [
      "In Unity 6.1 this is a separate package. The built-in Editor integration arrives in 6.4."
    ],
    "searchTerms": [
      "Project Auditor"
    ],
    "packageId": "com.unity.project-auditor"
  },
  "6.1-2": {
    "slug": "water-deformation",
    "technicalName": "HDRP water deformation",
    "links": [
      {
        "label": "Deform a water surface vertically",
        "url": "https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/water-deform-a-water-surface.html"
      }
    ],
    "overview": [
      "HDRP water decals can deform a water surface vertically and horizontally. A Shader Graph material defines the pattern, including rolling waves."
    ],
    "steps": [
      "Enable Deformation in the water surface’s Water Decals settings.",
      "Add GameObject > Water > Water Decal, create a Deformer and Foam Water Decal material, and edit its Shader Graph."
    ],
    "notes": [
      "Requires HDRP’s water system. Deformation changes height; it is not a general fluid simulation."
    ],
    "searchTerms": [
      "water deformation"
    ],
    "packageId": "com.unity.render-pipelines.high-definition"
  },
  "6.1-3": {
    "slug": "webgpu",
    "technicalName": "Experimental WebGPU",
    "links": [
      {
        "label": "WebGPU (Experimental)",
        "url": "https://docs.unity3d.com/6000.1/Documentation/Manual/WebGPU.html"
      }
    ],
    "overview": [
      "WebGPU provides a newer browser graphics backend. Unity 6.1 exposes it experimentally so developers can explore its capabilities with web builds."
    ],
    "steps": [
      "Follow the WebGPU setup guide to select the experimental backend for a web build.",
      "Run the build in a compatible browser and inspect its rendering and feature support."
    ],
    "notes": [
      "Experimental in 6.1. Requires a WebGPU-compatible browser, operating system, and GPU."
    ],
    "searchTerms": [
      "WebGPU"
    ]
  },
  "6.1-4": {
    "slug": "variable-rate-shading",
    "technicalName": "Variable Rate Shading",
    "links": [
      {
        "label": "Optimize Renderer Features with Variable Rate Shading in Unity 6.1",
        "url": "https://discussions.unity.com/t/optimize-renderer-features-with-variable-rate-shading-in-unity-6-1/1605893"
      },
      {
        "label": "ShadingRateInfo",
        "url": "https://docs.unity3d.com/6000.1/Documentation/ScriptReference/Rendering.ShadingRateInfo.html"
      },
      {
        "label": "Official shading-rate demo",
        "url": "https://github.com/Unity-Technologies/shading-rate-demo"
      }
    ],
    "overview": [
      "Variable Rate Shading lets rendering use different shading rates across an image. Selected areas can use fewer pixel-shader evaluations when full detail is unnecessary."
    ],
    "steps": [
      "Check the device’s Variable Rate Shading capabilities through ShadingRateInfo.",
      "Use the renderer-feature example to supply a shading-rate image for the regions you want to reduce."
    ],
    "notes": [
      "Requires compatible hardware and graphics API support. The API reports per-draw capability, but Unity does not support that mode in this version."
    ],
    "searchTerms": [
      "Variable Rate Shading",
      "VRS"
    ]
  },
  "6.1-5": {
    "slug": "build-profile-quality",
    "technicalName": "Build profile quality overrides",
    "links": [
      {
        "label": "Override build profile settings",
        "url": "https://docs.unity3d.com/6000.1/Documentation/Manual/build-profiles-override-settings.html"
      }
    ],
    "overview": [
      "Build profiles can override quality settings per target. A mobile or lower-spec profile can use a different quality selection without changing the project-wide defaults."
    ],
    "steps": [
      "Open File > Build Profiles and select the target profile.",
      "Add quality-setting overrides and choose the quality levels available to that build."
    ],
    "notes": [
      "Overrides apply in Play mode as well as the built Player when that profile is active."
    ],
    "searchTerms": [
      "Build Profiles",
      "quality settings"
    ]
  },
  "6.0-0": {
    "slug": "gpu-resident-drawer",
    "technicalName": "GPU Resident Drawer",
    "links": [
      {
        "label": "GPU Resident Drawer",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/urp/gpu-resident-drawer.html"
      },
      {
        "label": "GPU occlusion culling of instances",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/urp/gpu-culling.html"
      }
    ],
    "overview": [
      "GPU Resident Drawer uses GPU instancing to reduce CPU draw-call work for compatible objects. GPU occlusion culling can then skip objects hidden behind other geometry."
    ],
    "steps": [
      "Keep BatchRendererGroup shader variants in Graphics settings and enable the SRP Batcher in URP.",
      "Set GPU Resident Drawer to Instanced Drawing and use the Forward+ rendering path."
    ],
    "notes": [
      "The 6.0 URP workflow requires compatible Mesh Renderers and compute-shader support. OpenGL ES is excluded, and build times can increase because more shader variants are kept."
    ],
    "searchTerms": [
      "GPU Resident Drawer"
    ],
    "packageId": "com.unity.render-pipelines.universal"
  },
  "6.0-1": {
    "slug": "adaptive-probe-volumes",
    "technicalName": "Adaptive Probe Volumes",
    "links": [
      {
        "label": "Display Adaptive Probe Volumes",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/urp/probevolumes-showandadjust.html"
      },
      {
        "label": "Adaptive Probe Volume window",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/lighting-window.html#ProbeVolumes"
      }
    ],
    "overview": [
      "Adaptive Probe Volumes place and manage baked lighting probes across a scene. They let moving objects receive indirect lighting from the surrounding environment."
    ],
    "steps": [
      "Use the Adaptive Probe Volumes tab in Window > Rendering > Lighting to configure and bake probe data.",
      "Open Rendering Debugger and display probes to inspect their density and identify invalid samples."
    ],
    "notes": [
      "Adaptive Probe Volumes use baked lighting data and are available in URP and HDRP. They are not a replacement for all real-time lighting."
    ],
    "searchTerms": [
      "Adaptive Probe Volumes",
      "APV"
    ]
  },
  "6.0-2": {
    "slug": "multiplayer-center",
    "technicalName": "Multiplayer Center",
    "links": [
      {
        "label": "Multiplayer Center setup",
        "url": "https://docs.unity.com/en-us/multiplayer/multiplayer-center"
      },
      {
        "label": "Unity 6.0 Multiplayer Center package",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/com.unity.multiplayer.center.html"
      }
    ],
    "overview": [
      "Multiplayer Center recommends packages from the game’s needs and links to setup examples. Multiplayer Play Mode supports testing several players from the development environment."
    ],
    "steps": [
      "Open Window > Multiplayer > Multiplayer Center and enter the game specifications.",
      "Install the chosen packages, then follow their Quickstart steps and use Multiplayer Play Mode for local multi-player testing."
    ],
    "notes": [
      "Networking packages and hosted services have separate setup requirements. Installing the recommendations does not make gameplay network-aware automatically."
    ],
    "searchTerms": [
      "Multiplayer Center"
    ],
    "packageId": "com.unity.multiplayer.center"
  },
  "6.0-3": {
    "slug": "build-profiles",
    "technicalName": "Build Profiles",
    "links": [
      {
        "label": "Build Profiles",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/build-profiles.html"
      }
    ],
    "overview": [
      "Build Profiles save independent build configurations as project assets. Teams can keep separate target-platform, development, and release setups in version control."
    ],
    "steps": [
      "Open File > Build Profiles and copy a platform to a new profile.",
      "Name the profile, choose its scenes and build options, and save the profile asset with the project."
    ],
    "notes": [
      "Platform entries share settings; custom build profiles provide the independent configurations."
    ],
    "searchTerms": [
      "Build Profiles"
    ]
  },
  "6.0-4": {
    "slug": "distributed-authority",
    "technicalName": "Distributed authority",
    "links": [
      {
        "label": "Distributed authority documentation (current package)",
        "url": "https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@latest?subfolder=/manual/terms-concepts/distributed-authority.html"
      },
      {
        "label": "Multiplayer Use Cases Bitesize Sample",
        "url": "https://github.com/Unity-Technologies/com.unity.multiplayer.samples.bitesize/tree/main/Basic/MultiplayerUseCases"
      }
    ],
    "overview": [
      "Distributed authority lets clients own different parts of a networked simulation instead of putting all authority on one game host. It changes how ownership and synchronization are designed."
    ],
    "steps": [
      "Use the distributed-authority documentation to configure the appropriate Netcode for GameObjects and multiplayer service setup.",
      "Study the official sample’s ownership and synchronization flow before assigning gameplay responsibilities to clients."
    ],
    "notes": [
      "Beta at the Unity 6 launch. Client ownership has different trust and failure-handling implications from a server-authoritative design. Current package documentation may describe later changes."
    ],
    "searchTerms": [
      "distributed authority"
    ],
    "packageId": "com.unity.netcode.gameobjects"
  },
  "6.0-5": {
    "slug": "sentis",
    "technicalName": "Sentis runtime AI",
    "links": [
      {
        "label": "Sentis 2.1 documentation",
        "url": "https://docs.unity3d.com/Packages/com.unity.sentis@2.1/manual/index.html"
      }
    ],
    "overview": [
      "Sentis imports trained models and runs inference on the player’s CPU or GPU. It can turn model output into gameplay behavior without sending each inference request to a remote server."
    ],
    "steps": [
      "Install Sentis, import a supported ONNX model, and prepare its expected input tensors.",
      "Create an execution worker, run the model, and read its outputs in the game code."
    ],
    "notes": [
      "Sentis runs trained models; it does not train them. Supported operators, model size, and device resources determine whether a model is suitable."
    ],
    "searchTerms": [
      "Sentis"
    ],
    "packageId": "com.unity.sentis"
  },
  "6.0-6": {
    "slug": "memory-profiler",
    "technicalName": "Memory Profiler",
    "links": [
      {
        "label": "Memory Profiler guide",
        "url": "https://docs.unity3d.com/Packages/com.unity.memoryprofiler@1.1/manual/index.html"
      }
    ],
    "overview": [
      "Memory Profiler captures snapshots that show allocations and the objects retaining them. Comparing snapshots helps identify growth between two points in a game session."
    ],
    "steps": [
      "Install Memory Profiler and capture a snapshot from the Editor or a connected Player.",
      "Inspect the memory categories and reference chains, or compare two snapshots to find allocations that remain."
    ],
    "notes": [
      "A snapshot pauses the target while collecting data and can be large. Editor memory includes overhead that is absent from a Player build."
    ],
    "searchTerms": [
      "Memory Profiler"
    ],
    "packageId": "com.unity.memoryprofiler"
  },
  "6.0-7": {
    "slug": "ui-builder",
    "technicalName": "UI Builder and runtime data binding",
    "links": [
      {
        "label": "runtime binding system",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/UIE-runtime-binding.html"
      },
      {
        "label": "custom property drawers",
        "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/ui-systems/custom-control-customize-uxml-attributes.html#add-custom-property-drawer-in-ui-builder"
      }
    ],
    "overview": [
      "UI Builder exposes more control authoring and styling workflows. Runtime data binding connects UI properties to C# data so a display can follow changes in the game model."
    ],
    "steps": [
      "Create or open a UXML document in UI Builder and style its controls with USS.",
      "Use runtime data binding for plain C# data, or expose custom control attributes to make them editable in UI Builder."
    ],
    "notes": [
      "For serialized Editor data, SerializedObject binding provides undo and multi-selection support that runtime binding does not replace."
    ],
    "searchTerms": [
      "UI Builder",
      "runtime binding"
    ]
  }
};
