---
schemaVersion: 1
id: trig-unit-circle
path:
  category: trigonometry
  subcategory: unit-circle-radians
  chapter: unit-circle
chapterOrder: 1
level: intermediate
estimatedMinutes: 12
prerequisites:
  - trig-right-triangle-ratios
next:
  - trig-radians-arc-length
terms:
  - id: unit-circle
parameters:
  - id: angle
    kind: number
    min: 0
    max: 360
    step: 1
    default: 30
    unit: deg
  - id: showTangent
    kind: toggle
    min: 0
    max: 1
    step: 1
    default: 0
    unit: none
derived:
  - id: theta
    expr: rad(angle)
  - id: s
    expr: sin(theta)
  - id: c
    expr: cos(theta)
  - id: t
    expr: tan(theta)
scene:
  type: unit-circle
  v: 1
  angle: angle
  snap:
    values: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360]
    within: 3
  tangent:
    when: showTangent
  wave:
    fn: sin
    from: 0
    to: 360
  quadrants: true
  readouts:
    - id: rs
      expr: s
      decimals: 4
    - id: rc
      expr: c
      decimals: 4
steps:
  - id: s1
    sceneState:
      params:
        angle: 30
      show:
        - circle
        - point
  - id: s2
    formulaRefs:
      - f1
    sceneState:
      show:
        - sine
        - wave
  - id: s3
    formulaRefs:
      - f2
    sceneState:
      show:
        - cosine
formulas:
  - id: f1
    latex: \sin\theta = {{s}}
    bind:
      s:
        expr: sin(rad(angle))
        decimals: 4
    checks:
      - at:
          angle: 30
        expect:
          s: 0.5
      - at:
          angle: 150
        expect:
          s: 0.5
  - id: f2
    latex: \cos\theta = {{c}}
    bind:
      c:
        expr: cos(rad(angle))
        decimals: 4
    checks:
      - at:
          angle: 60
        expect:
          c: 0.5
  - id: f3
    latex: \sin^2\theta + \cos^2\theta = 1
    identity:
      lhs: sin(rad(angle))^2 + cos(rad(angle))^2
      rhs: '1'
example:
  inputs:
    - id: a
      min: 0
      max: 360
      step: 1
      default: 30
      unit: deg
  lines:
    - math: \sin {{a}}^\circ = {{h}}
      calc:
        name: h
        expr: sin(rad(a))
        decimals: 4
        expect: 0.5
    - math: \cos {{a}}^\circ = {{w}}
      calc:
        name: w
        expr: cos(rad(a))
        decimals: 4
        expect: 0.866
  answer: {}
quiz: []
---

## en

### title
The Unit Circle and the Sine Wave

### summary
Drag a point round a circle and watch sine and cosine appear.

### goal
See how a point moving round the unit circle gives sine and cosine, and how sine draws a wave.

### tags
sine, cosine, unit circle, angle

### terms.unit-circle.term
unit circle

### terms.unit-circle.definition
A circle with radius 1 and its centre at the origin.

### parameters.angle.label
Angle

### parameters.showTangent.label
Show tangent

### scene.caption
A point on the unit circle. Its height is the sine, its width is the cosine.

### scene.description
A circle of radius 1 with a point you can drag. A vertical line shows the sine and a horizontal line shows the cosine. A second panel draws the sine wave as the point moves.

### scene.readouts.rs.label
Sine

### scene.readouts.rc.label
Cosine

### steps.s1.title
Drag the point

### steps.s1.body
Drag the point round the circle. The circle has radius 1.

### steps.s2.title
Sine is the height

### steps.s2.body
The height of the point is the **sine**. At 30 degrees it is 0.5.

### steps.s3.title
Cosine is the width

### steps.s3.body
The width of the point is the **cosine**. It is 0.866 at 30 degrees.

### formulas.f1.caption
Sine of the angle

### formulas.f2.caption
Cosine of the angle

### example.title
Find sine and cosine at an angle

### example.problem
A point sits at {{a}} degrees on the unit circle. Find its height and width.

### example.inputs.a.label
Angle

### example.lines.1.text
The height is the sine of the angle.

### example.lines.2.text
The width is the cosine of the angle.

### example.answer.text
Height {{h}}, width {{w}}.

### tryThis.1
Drag the point to 90 degrees. What is the width?

### tryThis.2
Find two angles where the sine is 0.5.

### watchOut
Sine is the height, not the distance along the circle.

## ur

### title
اکائی دائرہ اور سائن کی موج

### summary
دائرے پر نقطہ گھمائیں اور سائن اور کوسائن بنتے دیکھیں۔

### goal
دیکھیں کہ اکائی دائرے پر گھومتا ہوا نقطہ سائن اور کوسائن کیسے دیتا ہے، اور سائن کیسے ایک موج بناتا ہے۔

### tags
سائن، کوسائن، اکائی دائرہ، زاویہ

### terms.unit-circle.term
اکائی دائرہ

### terms.unit-circle.definition
ایسا دائرہ جس کا رداس 1 ہو اور مرکز مبدا پر ہو۔

### parameters.angle.label
زاویہ

### parameters.showTangent.label
ٹینجنٹ دکھائیں

### scene.caption
اکائی دائرے پر ایک نقطہ۔ اس کی اونچائی سائن اور چوڑائی کوسائن ہے۔

### scene.description
رداس 1 کا ایک دائرہ جس پر ایک نقطہ گھمایا جا سکتا ہے۔ عمودی لکیر سائن اور افقی لکیر کوسائن دکھاتی ہے۔ دوسرا خانہ نقطہ چلنے پر سائن کی موج بناتا ہے۔

### scene.readouts.rs.label
سائن

### scene.readouts.rc.label
کوسائن

### steps.s1.title
نقطہ گھمائیں

### steps.s1.body
نقطے کو دائرے پر گھمائیں۔ دائرے کا رداس 1 ہے۔

### steps.s2.title
سائن اونچائی ہے

### steps.s2.body
نقطے کی اونچائی **سائن** ہے۔ 30 ڈگری پر یہ 0.5 ہے۔

### steps.s3.title
کوسائن چوڑائی ہے

### steps.s3.body
نقطے کی چوڑائی **کوسائن** ہے۔ 30 ڈگری پر یہ 0.866 ہے۔

### formulas.f1.caption
زاویے کا سائن

### formulas.f2.caption
زاویے کا کوسائن

### example.title
کسی زاویے پر سائن اور کوسائن معلوم کریں

### example.problem
اکائی دائرے پر ایک نقطہ {{a}} ڈگری پر ہے۔ اس کی اونچائی اور چوڑائی معلوم کریں۔

### example.inputs.a.label
زاویہ

### example.lines.1.text
اونچائی زاویے کا سائن ہے۔

### example.lines.2.text
چوڑائی زاویے کا کوسائن ہے۔

### example.answer.text
اونچائی {{h}}، چوڑائی {{w}}۔

### tryThis.1
نقطے کو 90 ڈگری پر لے جائیں۔ چوڑائی کیا ہے؟

### tryThis.2
دو ایسے زاویے تلاش کریں جن کا سائن 0.5 ہو۔

### watchOut
سائن اونچائی ہے، دائرے کے ساتھ فاصلہ نہیں۔
