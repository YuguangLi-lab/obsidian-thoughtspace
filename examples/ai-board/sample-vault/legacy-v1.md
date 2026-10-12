---
thoughtspace: board
ai_example: legacy-v1
custom_sentinel: "AI-YAML-PRESERVE-legacy-v1"
tags: [ai-board-example, synthetic]
---

# legacy-v1 自制白板

<!-- AI-BODY-BEFORE-legacy-v1 -->

布局区外的正文和 YAML 交由原生 Markdown 编辑器管理。

<!-- thoughtspace-board-layout:start -->
```json
{
  "aiEnvelopeOpaque": {
    "sentinel": "AI-OPAQUE-PRESERVE-legacy-v1-envelope",
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
    "version": 1,
    "viewport": {
      "x": 60.123456789012344,
      "y": 60.23456789012346,
      "zoom": 0.9876543210987654
    },
    "aiExampleOpaque": {
      "sentinel": "AI-OPAQUE-PRESERVE-legacy-v1",
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
        "id": "legacy-v1-group",
        "kind": "section",
        "title": "自制样例分组",
        "x": 40.125,
        "y": 40.25,
        "width": 900.5,
        "height": 700.75,
        "color": "sand",
        "aiNodeOpaque": {
          "sentinel": "AI-OPAQUE-PRESERVE-legacy-v1-group",
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
        "id": "legacy-v1-note",
        "kind": "card",
        "file": "notes/source.md",
        "title": "自制来源笔记",
        "x": 120.375,
        "y": 180.625,
        "width": 320.125,
        "height": 240.0625,
        "color": "blue",
        "aiNodeOpaque": {
          "sentinel": "AI-OPAQUE-PRESERVE-legacy-v1-note",
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
        "id": "legacy-v1-relation",
        "from": "legacy-v1-group",
        "to": "legacy-v1-note",
        "label": "分组说明",
        "aiEdgeOpaque": {
          "sentinel": "AI-OPAQUE-PRESERVE-legacy-v1-relation",
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

<!-- AI-BODY-AFTER-legacy-v1 -->

此文件只用于自制样例库；不包含真实用户资料。
