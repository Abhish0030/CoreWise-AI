# Migration link audit

Imported the existing COA Project vault on 2026-11-05. All original note filenames (including `.md.md`), folder hierarchy, and attachment bytes are preserved. Only links to existing files were converted from Obsidian wiki syntax to relative Markdown links so they render in Obsidian and GitHub. Code fences were left unchanged.

31 Markdown notes and 9 attachments imported; 197 links repaired. All generated local Markdown link targets exist.

## Existing unresolved wiki links

These targets were already absent from the source vault. They remain as wiki links rather than inventing content or guessing a different target. Create the intended notes or update these references in a reviewed follow-up.

| Source | Line | Missing target |
| --- | ---: | --- |
| `docs/00-Dashboard/Project-Overview.md.md` | 107 | `Experiments` |
| `docs/00-Dashboard/Project-Overview.md.md` | 109 | `Meeting-Notes` |
| `docs/02-COA-Concepts/Amdahls-Law.md.md` | 693 | `Research-Papers` |
| `docs/02-COA-Concepts/Amdahls-Law.md.md` | 697 | `CoreWise-AI-System-Architecture` |
| `docs/02-COA-Concepts/Amdahls-Law.md.md` | 699 | `Benchmarking-Methodology` |
| `docs/02-COA-Concepts/CPU-Architecture.md.md` | 592 | `Research-Papers` |
| `docs/02-COA-Concepts/GPU-Architecture.md.md` | 994 | `Research-Papers` |
| `docs/02-COA-Concepts/GPU-Architecture.md.md` | 998 | `CoreWise-AI-System-Architecture` |
| `docs/02-COA-Concepts/GPU-Architecture.md.md` | 1000 | `Benchmarking-Methodology` |
| `docs/02-COA-Concepts/Memory-Hierarchy.md.md` | 891 | `Research-Papers` |
| `docs/02-COA-Concepts/Memory-Hierarchy.md.md` | 895 | `CoreWise-AI-System-Architecture` |
| `docs/02-COA-Concepts/Memory-Hierarchy.md.md` | 897 | `Benchmarking-Methodology` |
| `docs/02-COA-Concepts/Parallel-Processing.md.md` | 730 | `Research-Papers` |
| `docs/02-COA-Concepts/Parallel-Processing.md.md` | 734 | `CoreWise-AI-System-Architecture` |
| `docs/02-COA-Concepts/Parallel-Processing.md.md` | 736 | `Benchmarking-Methodology` |
| `docs/03-Mathematics/Execution-Time.md.md` | 506 | `Benchmarking-Methodology` |
| `docs/03-Mathematics/Execution-Time.md.md` | 508 | `ML-Prediction-Model` |
| `docs/03-Mathematics/Performance-Metrics.md.md` | 780 | `Benchmarking-Methodology` |
| `docs/03-Mathematics/Performance-Metrics.md.md` | 782 | `ML-Prediction-Model` |
| `docs/03-Mathematics/Speedup.md.md` | 588 | `Benchmarking-Methodology` |
| `docs/03-Mathematics/Speedup.md.md` | 590 | `ML-Prediction-Model` |
| `docs/03-Mathematics/Throughput.md.md` | 543 | `Benchmarking-Methodology` |
| `docs/03-Mathematics/Throughput.md.md` | 545 | `ML-Prediction-Model` |
| `docs/04-Machine-Learning/Algorithms.md.md` | 646 | `ML-Prediction-Model` |
| `docs/04-Machine-Learning/Algorithms.md.md` | 656 | `Agentic-AI-Architecture` |
| `docs/04-Machine-Learning/Algorithms.md.md` | 664 | `CoreWise-AI-System-Architecture` |
| `docs/04-Machine-Learning/Dataset.md.md` | 614 | `ML-Prediction-Model` |
| `docs/04-Machine-Learning/Dataset.md.md` | 632 | `CoreWise-AI-System-Architecture` |
| `docs/04-Machine-Learning/Feature-Engineering.md.md` | 796 | `ML-Prediction-Model` |
| `docs/04-Machine-Learning/Feature-Engineering.md.md` | 804 | `Model-Explainability` |
| `docs/04-Machine-Learning/Feature-Engineering.md.md` | 818 | `CoreWise-AI-System-Architecture` |
| `docs/04-Machine-Learning/Model-Evaluation.md.md` | 645 | `ML-Prediction-Model` |
| `docs/04-Machine-Learning/Model-Evaluation.md.md` | 653 | `Model-Explainability` |
| `docs/04-Machine-Learning/Model-Evaluation.md.md` | 661 | `CoreWise-AI-System-Architecture` |
| `docs/04-Machine-Learning/Model-Training.md.md` | 840 | `ML-Prediction-Model` |
| `docs/04-Machine-Learning/Model-Training.md.md` | 848 | `Model-Explainability` |
| `docs/04-Machine-Learning/Model-Training.md.md` | 856 | `CoreWise-AI-System-Architecture` |
| `docs/05-Agentic-AI/Agent-Architecture.md.md` | 870 | `CoreWise-AI-System-Architecture` |
| `docs/05-Agentic-AI/Agent-Architecture.md.md` | 872 | `ML-Prediction-Model` |
| `docs/05-Agentic-AI/Agent-Architecture.md.md` | 882 | `Model-Explainability` |
| `docs/05-Agentic-AI/AI-Recommendation-System.md.md` | 986 | `CoreWise-AI-System-Architecture` |
| `docs/05-Agentic-AI/AI-Recommendation-System.md.md` | 988 | `Agentic-AI-Architecture` |
| `docs/05-Agentic-AI/AI-Recommendation-System.md.md` | 990 | `Agent-Workflow` |
| `docs/05-Agentic-AI/AI-Recommendation-System.md.md` | 992 | `ML-Prediction-Model` |
| `docs/05-Agentic-AI/AI-Recommendation-System.md.md` | 998 | `Model-Explainability` |
| `docs/05-Agentic-AI/LangGraph-Workflow.md.md` | 871 | `Agentic-AI-Architecture` |
| `docs/05-Agentic-AI/LangGraph-Workflow.md.md` | 873 | `ML-Prediction-Model` |
| `docs/05-Agentic-AI/LangGraph-Workflow.md.md` | 883 | `Model-Explainability` |
| `docs/05-Agentic-AI/LangGraph-Workflow.md.md` | 885 | `CoreWise-AI-System-Architecture` |
| `docs/06-System-Architecture/API-Design.md.md` | 1446 | `CoreWise-AI-System-Architecture` |
| `docs/06-System-Architecture/API-Design.md.md` | 1448 | `Agentic-AI-Architecture` |
| `docs/06-System-Architecture/API-Design.md.md` | 1450 | `Tools-and-Function-Calling` |
| `docs/06-System-Architecture/API-Design.md.md` | 1452 | `Memory-and-Context-Management` |
| `docs/06-System-Architecture/API-Design.md.md` | 1454 | `ML-Prediction-Model` |
| `docs/06-System-Architecture/API-Design.md.md` | 1464 | `Model-Explainability` |
| `docs/06-System-Architecture/Backend.md.md` | 1682 | `CoreWise-AI-System-Architecture` |
| `docs/06-System-Architecture/Backend.md.md` | 1684 | `Agentic-AI-Architecture` |
| `docs/06-System-Architecture/Backend.md.md` | 1686 | `Agent-Workflow` |
| `docs/06-System-Architecture/Backend.md.md` | 1688 | `Tools-and-Function-Calling` |
| `docs/06-System-Architecture/Backend.md.md` | 1690 | `Memory-and-Context-Management` |
| `docs/06-System-Architecture/Backend.md.md` | 1692 | `ML-Prediction-Model` |
| `docs/06-System-Architecture/Backend.md.md` | 1702 | `Model-Explainability` |
| `docs/06-System-Architecture/Frontend.md.md` | 1433 | `CoreWise-AI-System-Architecture` |
| `docs/06-System-Architecture/Frontend.md.md` | 1435 | `Agentic-AI-Architecture` |
| `docs/06-System-Architecture/Frontend.md.md` | 1437 | `Tools-and-Function-Calling` |
| `docs/06-System-Architecture/Frontend.md.md` | 1439 | `ML-Prediction-Model` |
| `docs/06-System-Architecture/Frontend.md.md` | 1443 | `Model-Explainability` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 616 | `ML-Prediction-Model` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 898 | `Agentic-AI-Architecture` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 900 | `Agent-Workflow` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 902 | `Tools-and-Function-Calling` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 904 | `Memory-and-Context-Management` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 958 | `Model-Explainability` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1062 | `Memory-and-Context-Management` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1064 | `Agent-Workflow` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1535 | `CoreWise-AI-System-Architecture` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1564 | `ML-Prediction-Model` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1574 | `Model-Explainability` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1579 | `Agentic-AI-Architecture` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1581 | `Agent-Workflow` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1583 | `Tools-and-Function-Calling` |
| `docs/06-System-Architecture/Overall-Architecture.md.md` | 1585 | `Memory-and-Context-Management` |
