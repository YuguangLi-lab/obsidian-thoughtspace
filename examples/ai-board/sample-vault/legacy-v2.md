---
thoughtspace: board
ai_example: legacy-v2
custom_sentinel: "AI-YAML-PRESERVE-legacy-v2"
tags: [ai-board-example, synthetic]
---

# legacy-v2 自制白板

<!-- AI-BODY-BEFORE-legacy-v2 -->

布局区外的正文和 YAML 交由原生 Markdown 编辑器管理。

<!-- thoughtspace-board-layout:start -->
```json
{
  "aiEnvelopeOpaque": {
    "sentinel": "AI-OPAQUE-PRESERVE-legacy-v2-envelope",
    "precision": 0.12345678901234568,
    "nested": {
      "labels": [
        "自制",
        "保留"
      ],
      "flag": true
    }
  },
  "format": "thoughtspace-board",
  "version": 1,
  "board": {
    "version": 2,
    "viewport": {
      "x": 60.123456789012344,
      "y": 60.23456789012346,
      "zoom": 0.9876543210987654
    },
    "aiExampleOpaque": {
      "sentinel": "AI-OPAQUE-PRESERVE-legacy-v2",
      "precision": 0.12345678901234568,
      "nested": {
        "labels": [
          "自制",
          "保留"
        ],
        "flag": true
      }
    },
    "nodes": [
      {
        "id": "legacy-v2-note",
        "kind": "card",
        "file": "notes/source.md",
        "title": "自制来源笔记",
        "x": 120.375,
        "y": 180.625,
        "width": 320.125,
        "height": 240.0625,
        "color": "blue",
        "aiNodeOpaque": {
          "sentinel": "AI-OPAQUE-PRESERVE-legacy-v2-note",
          "precision": 0.12345678901234568,
          "nested": {
            "labels": [
              "自制",
              "保留"
            ],
            "flag": true
          }
        }
      },
      {
        "id": "legacy-v2-board",
        "kind": "board",
        "file": "ordinary-v3.md",
        "title": "同库普通白板",
        "x": 500.375,
        "y": 180.625,
        "width": 320.125,
        "height": 240.0625,
        "color": "green",
        "aiNodeOpaque": {
          "sentinel": "AI-OPAQUE-PRESERVE-legacy-v2-board",
          "precision": 0.12345678901234568,
          "nested": {
            "labels": [
              "自制",
              "保留"
            ],
            "flag": true
          }
        }
      }
    ],
    "edges": [
      {
        "id": "legacy-v2-relation",
        "from": "legacy-v2-note",
        "to": "legacy-v2-board",
        "label": "进一步整理",
        "aiEdgeOpaque": {
          "sentinel": "AI-OPAQUE-PRESERVE-legacy-v2-relation",
          "precision": 0.12345678901234568,
          "nested": {
            "labels": [
              "自制",
              "保留"
            ],
            "flag": true
          }
        }
      }
    ]
  }
}
```
<!-- thoughtspace-board-layout:end -->

<!-- AI-BODY-AFTER-legacy-v2 -->

此文件只用于自制样例库；不包含真实用户资料。
