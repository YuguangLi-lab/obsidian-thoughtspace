---
thoughtspace: board
ai_example: handwriting-v3
custom_sentinel: "AI-YAML-PRESERVE-handwriting-v3"
tags: [ai-board-example, synthetic]
---

# handwriting-v3 自制白板

<!-- AI-BODY-BEFORE-handwriting-v3 -->

布局区外的正文和 YAML 交由原生 Markdown 编辑器管理。

<!-- thoughtspace-board-layout:start -->
```json
{
  "aiEnvelopeOpaque": {
    "sentinel": "AI-OPAQUE-PRESERVE-handwriting-v3-envelope",
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
    "version": 3,
    "viewport": {
      "x": 60.123456789012344,
      "y": 60.23456789012346,
      "zoom": 0.9876543210987654
    },
    "aiExampleOpaque": {
      "sentinel": "AI-OPAQUE-PRESERVE-handwriting-v3",
      "precision": 0.12345678901234568,
      "nested": {
        "labels": [
          "自制",
          "保留"
        ],
        "flag": true
      }
    },
    "presentation": "handwriting",
    "nodes": [],
    "edges": [],
    "ink": {
      "version": 1,
      "aiInkOpaque": {
        "sentinel": "AI-OPAQUE-PRESERVE-handwriting-v3-ink",
        "precision": 0.12345678901234568,
        "nested": {
          "labels": [
            "自制",
            "保留"
          ],
          "flag": true
        }
      },
      "strokes": [
        {
          "id": "ink-example-line",
          "color": "#2764ab",
          "width": 3.125,
          "points": [
            [
              140.12345678901235,
              180.23456789012346,
              0
            ],
            [
              175.375,
              155.625,
              0.25
            ],
            [
              210.0625,
              188.3125,
              0.875
            ],
            [
              245.23456789012346,
              158.12345678901235,
              1
            ]
          ],
          "aiStrokeOpaque": {
            "sentinel": "AI-OPAQUE-PRESERVE-ink-example-line",
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
          "id": "ink-example-dot",
          "color": "#a24862",
          "width": 6.0625,
          "points": [
            [
              280.1234567890123,
              210.23456789012346,
              0.3333333333333333
            ]
          ],
          "aiStrokeOpaque": {
            "sentinel": "AI-OPAQUE-PRESERVE-ink-example-dot",
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
}
```
<!-- thoughtspace-board-layout:end -->

<!-- AI-BODY-AFTER-handwriting-v3 -->

此文件只用于自制样例库；不包含真实用户资料。
