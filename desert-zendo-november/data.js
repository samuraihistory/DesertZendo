// Content for Desert Zendo November.
//
// All practice text below is original wording written for this app. It is
// inspired by the everyday practices Thich Nhat Hanh taught in the 1990s and
// 2000s (mindful breathing, walking, eating, deep listening, and so on), but it
// does not quote his books, Plum Village liturgy, or gathas, which are under
// copyright. Each day's early-Buddhist reading lives in readings.js and its
// Zen saying in zen.js. See DATASETS.md for licensing notes.

window.NHN_DATA = (function () {
  "use strict";

  // One theme per day of November. `practice` is the thing to do today;
  // `prompt` is the diary question for the evening.
  const THEMES = [
    {
      title: "Arriving in the breath",
      practice:
        "Three times today, stop whatever you are doing and follow one full breath in and one full breath out. Notice that the breath is long or short without changing it. That's all.",
      prompt: "When did you actually feel present today? What brought you there?",
    },
    {
      title: "Walking without a destination",
      practice:
        "Walk somewhere slowly for ten minutes — a hallway, a yard, a sidewalk. Match your steps to your breath. You are not going anywhere; each step is already the arrival.",
      prompt: "What did you notice underfoot that you usually miss?",
    },
    {
      title: "Dishes for their own sake",
      practice:
        "Wash the dishes as if it were the only thing in the world worth doing. Feel the warm water, the weight of each plate. Don't hurry to get to the tea afterward.",
      prompt: "What chore could become practice instead of an interruption?",
    },
    {
      title: "One piece of fruit",
      practice:
        "Eat a single piece of fruit with full attention. Peel it slowly, smell it, notice the sun, rain and hands that brought it to you. Take ten minutes if you can.",
      prompt: "What did the fruit taste like when you were really there for it?",
    },
    {
      title: "A cup of tea",
      practice:
        "Make one cup of tea or coffee and drink it with nothing else — no phone, no reading. Hold the cup with both hands and let it be the whole morning.",
      prompt: "What usually competes for your attention during small pleasures?",
    },
    {
      title: "A small smile",
      practice:
        "Several times today, let a very small smile rest on your lips — at a red light, waking up, before answering someone. Notice what it does to the face and the shoulders.",
      prompt: "Did the smile change anything in you or in anyone around you?",
    },
    {
      title: "The phone as a bell",
      practice:
        "Each time your phone rings or buzzes today, take one full breath before you look at it. Let the sound become an invitation instead of a command.",
      prompt: "How many times did you remember? How did it feel to wait one breath?",
    },
    {
      title: "Total relaxation",
      practice:
        "Lie on your back for fifteen minutes. Move your attention slowly from the feet to the crown of the head, thanking each part of the body and letting it soften.",
      prompt: "Which part of your body has been working hardest lately?",
    },
    {
      title: "Holding a hard feeling",
      practice:
        "When irritation or sadness arises, don't push it away or act on it. Breathe with it the way you would hold a crying child — gently, without needing it to stop right away.",
      prompt: "What feeling visited today, and what was underneath it?",
    },
    {
      title: "Listening all the way",
      practice:
        "In one conversation today, listen only to understand. Don't prepare a reply, don't correct, don't fix. Let the other person feel completely heard.",
      prompt: "What did you hear that you might have missed if you were waiting to talk?",
    },
    {
      title: "Kind, true speech",
      practice:
        "Before speaking today, ask: is it true, is it kind, is it the right time? Say one thing to someone that is true and that they would be glad to hear.",
      prompt: "What did you say — or not say — that you're glad about?",
    },
    {
      title: "What is your breakfast made of?",
      practice:
        "Look at one ordinary object — your bread, your sweater, this screen — and trace everything it is made of: soil, rain, sunlight, workers, trucks, time. Nothing exists by itself alone.",
      prompt: "What surprised you when you looked at something this way?",
    },
    {
      title: "Everything changes",
      practice:
        "Sit for ten minutes with the plain facts: this body ages, gets sick, will die; everything I love will change. Let it make today more precious, not more anxious.",
      prompt: "Knowing nothing lasts, what do you want to give your time to?",
    },
    {
      title: "Only this moment",
      practice:
        "Whenever you catch yourself rehearsing the future or replaying the past, come back to one breath and one thing you can see right now.",
      prompt: "Where did your mind keep traveling today?",
    },
    {
      title: "An unscheduled day",
      practice:
        "Leave as much of today unplanned as you can. No list, no goals. Rest, wander, nap, look out the window. Doing nothing is also nourishment.",
      prompt: "What did you do when nothing was required of you?",
    },
    {
      title: "Ancestors in your hands",
      practice:
        "Look at your hands and see the parents, grandparents and teachers who live on in them — their gestures, their strengths, their wounds. Breathe for them too.",
      prompt: "Which of your ancestors' qualities do you want to continue?",
    },
    {
      title: "A tree for a teacher",
      practice:
        "Go outside and spend ten minutes with a tree, a plant, or the sky. Don't think about it — just be with it, the way it is simply being with you.",
      prompt: "What did the natural world show you today?",
    },
    {
      title: "Red lights as reminders",
      practice:
        "Treat every red light, queue, loading screen and elevator wait as a chance to breathe and smile instead of a delay to resent.",
      prompt: "How did waiting feel when you treated it as a gift?",
    },
    {
      title: "A full-hearted hug",
      practice:
        "Give someone a hug that lasts three slow breaths. Be completely there for it. (A pet, or your own two arms, also count.)",
      prompt: "Who are you grateful is still alive and near?",
    },
    {
      title: "What grows from difficulty",
      practice:
        "Pick one painful thing from your life and look at what has grown from it — patience, compassion, understanding. Hard ground is often where the deepest roots form.",
      prompt: "What has your suffering taught you that you couldn't have learned otherwise?",
    },
    {
      title: "Careful consumption",
      practice:
        "Notice everything you take in today — food, news, feeds, conversation. Choose one thing to leave out that agitates you, and one thing to take in that nourishes you.",
      prompt: "What did you feed your mind today, and how does it feel now?",
    },
    {
      title: "Wishing others well",
      practice:
        "Sit for ten minutes and silently wish wellbeing to yourself, then someone you love, then someone neutral, then someone difficult: may you be safe, may you be at ease.",
      prompt: "Was it harder to wish yourself well, or the difficult person?",
    },
    {
      title: "Starting over",
      practice:
        "Think of one relationship with a small knot in it. Tell that person one thing you appreciate about them, and, if it's right, one regret of your own.",
      prompt: "What knot is ready to be loosened?",
    },
    {
      title: "One thing at a time",
      practice:
        "All day, do only one thing at a time. When you eat, eat. When you read, read. When you walk, walk. Notice the pull to multitask and smile at it.",
      prompt: "When was it hardest to do just one thing?",
    },
    {
      title: "Sitting just to sit",
      practice:
        "Sit for twenty minutes with no goal of becoming calm or wise. Enjoy sitting the way you'd enjoy sitting on a hillside. Nothing to attain.",
      prompt: "What happened when you stopped trying to meditate well?",
    },
    {
      title: "Work as practice",
      practice:
        "Choose one task — sweeping, cooking, email, raking leaves — and do it slowly and completely, breathing with the movements.",
      prompt: "What changed about the task when you gave it full attention?",
    },
    {
      title: "A gratitude meal",
      practice:
        "Before a meal, pause and name where the food came from and who made it possible. Eat the first five bites in silence.",
      prompt: "List five things from this month you are grateful for.",
    },
    {
      title: "Joy is a practice too",
      practice:
        "Make a list of the conditions for happiness you already have — eyes that see, legs that walk, a roof, a friend. Spend the day enjoying at least three of them on purpose.",
      prompt: "Which ordinary good thing did you finally notice?",
    },
    {
      title: "An island of yourself",
      practice:
        "When you feel swept along by worry or other people's moods, return to the breath as a safe island inside you. Nobody can take it away.",
      prompt: "What helps you come home to yourself?",
    },
    {
      title: "Continuation",
      practice:
        "Read back through this month's diary. Notice what changed. Choose one or two practices to carry with you into December.",
      prompt: "What do you want to continue? What will you let go of?",
    },
  ];

  const PRACTICES = [
    { id: "sitting", label: "Sitting meditation" },
    { id: "walking", label: "Walking meditation" },
    { id: "meal", label: "One mindful meal" },
    { id: "bell", label: "Paused for the bell" },
    { id: "relax", label: "Deep relaxation" },
    { id: "theme", label: "Today's theme practice" },
  ];

  const MOODS = [
    { value: 1, label: "Heavy" },
    { value: 2, label: "Unsettled" },
    { value: 3, label: "Steady" },
    { value: 4, label: "Light" },
    { value: 5, label: "Joyful" },
  ];

  const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Tea"];

  // Things to remember when the bell sounds. Original wording.
  const BELL_INVITATIONS = [
    "Stop. Breathe in. Breathe out. You have arrived.",
    "Let your shoulders drop. Three breaths, nothing else.",
    "Where are you right now? Come back.",
    "Breathing in, notice your body. Breathing out, let it soften.",
    "Smile a little. This moment is enough.",
    "Look up from what you're doing. Notice one thing you can see.",
  ];

  return { THEMES, PRACTICES, MOODS, MEAL_TYPES, BELL_INVITATIONS };
})();
