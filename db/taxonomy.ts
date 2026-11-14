import type { CategoryRules } from "./schema";

/** The two-level taxonomy from the architecture. Categories are data, not code: adding one is a row here. */
type Cat = {
  slug: string;
  name: string;
  rules: CategoryRules;
  skills: [slug: string, name: string, keywords: string][];
};

export const TAXONOMY: Cat[] = [
  {
    slug: "languages",
    name: "Languages",
    rules: { formats: ["live", "group", "async"], minTrust: 0, levelTags: true },
    skills: [
      ["english", "English", "speaking grammar ielts toefl pronunciation esl conversation"],
      ["spanish", "Spanish", "espanol conversation grammar latin america spain"],
      ["mandarin", "Mandarin Chinese", "chinese putonghua hsk pinyin characters tones"],
      ["french", "French", "francais conversation grammar delf"],
      ["russian", "Russian", "cyrillic conversation grammar"],
      ["kazakh", "Kazakh", "qazaq conversation grammar"],
      ["asl", "American Sign Language", "asl sign deaf signing fingerspelling"],
      ["conversation-practice", "Conversation practice", "speaking fluency small talk practice partner"],
    ],
  },
  {
    slug: "tech-coding",
    name: "Tech and coding",
    rules: { formats: ["live", "group", "async"], minTrust: 0, screenShare: true },
    skills: [
      ["web-development", "Web development", "html css javascript react nextjs frontend website"],
      ["python", "Python", "programming pandas numpy scripts automation pytorch"],
      ["sql", "SQL", "databases postgres queries joins mysql"],
      ["excel", "Excel and spreadsheets", "spreadsheet formulas pivot tables vlookup google sheets"],
      ["ai-tools", "AI tools", "chatgpt claude prompting llm machine learning automation"],
      ["cybersecurity-basics", "Cybersecurity basics", "security passwords phishing privacy hacking"],
      ["data-analysis", "Data analysis", "statistics charts dashboards pandas analytics"],
    ],
  },
  {
    slug: "design-creative",
    name: "Design and creative",
    rules: { formats: ["live", "group", "async"], minTrust: 0, notes: "Portfolio link optional" },
    skills: [
      ["figma", "Figma", "prototyping wireframes components design tool"],
      ["ui-ux", "UI/UX design", "user experience interface usability research"],
      ["branding", "Branding", "logo identity brand typography"],
      ["illustration", "Illustration", "drawing procreate digital art sketching"],
      ["3d-modeling", "3D modeling", "blender 3d render modeling sculpting"],
    ],
  },
  {
    slug: "video-photo-audio",
    name: "Video, photo and audio",
    rules: { formats: ["live", "async"], minTrust: 0 },
    skills: [
      ["video-editing", "Video editing", "premiere davinci resolve final cut cuts youtube"],
      ["color-grading", "Color grading", "colour grade luts davinci"],
      ["photography", "Photography", "camera composition lighting portraits lightroom photo"],
      ["podcast-production", "Podcast production", "audio recording mixing microphone podcast"],
    ],
  },
  {
    slug: "music",
    name: "Music",
    rules: { formats: ["live", "group", "in_person"], minTrust: 0 },
    skills: [
      ["guitar", "Guitar", "chords chord strumming acoustic electric riffs songs fingerpicking"],
      ["piano", "Piano", "keyboard keys chords sheet music classical"],
      ["voice", "Voice and singing", "singing vocal breath pitch"],
      ["music-production", "Music production", "ableton fl studio logic beats mixing daw"],
      ["music-theory", "Music theory", "scales harmony chords intervals reading music"],
    ],
  },
  {
    slug: "writing-communication",
    name: "Writing and communication",
    rules: { formats: ["live", "group", "async"], minTrust: 0 },
    skills: [
      ["essay-writing", "Essay writing", "essays academic writing structure college application"],
      ["copywriting", "Copywriting", "marketing copy headlines ads landing page"],
      ["public-speaking", "Public speaking", "presentations nervous speech talks confidence pitching"],
      ["storytelling", "Storytelling", "stories narrative creative writing fiction"],
    ],
  },
  {
    slug: "career-business",
    name: "Career and business",
    rules: { formats: ["live", "async"], minTrust: 0, notes: "Mentoring, not hiring" },
    skills: [
      ["resume-review", "Resume review", "cv resume linkedin job application"],
      ["interview-practice", "Interview practice", "job interview mock behavioral technical practice"],
      ["marketing", "Marketing", "social media growth seo content marketing"],
      ["sales", "Sales", "selling negotiation cold outreach"],
      ["product-management", "Product management", "product roadmap discovery prioritization pm"],
    ],
  },
  {
    slug: "academic",
    name: "Academic tutoring",
    rules: { formats: ["live", "group", "async"], minTrust: 0, notes: "Adults only" },
    skills: [
      ["math", "Math", "algebra calculus statistics geometry olympiad probability"],
      ["physics", "Physics", "mechanics electromagnetism waves"],
      ["chemistry", "Chemistry", "organic reactions periodic"],
      ["history", "History", "world history essays"],
      ["test-prep", "Test prep", "sat gre gmat ielts exam preparation"],
    ],
  },
  {
    slug: "money-basics",
    name: "Money basics",
    rules: {
      formats: ["live", "group"],
      minTrust: 0,
      notes: "Education only, no personal investment advice",
    },
    skills: [
      ["budgeting", "Budgeting tools", "budget expenses saving apps"],
      ["personal-spreadsheets", "Money spreadsheets", "spreadsheet tracking finances"],
      ["how-credit-works", "How credit works", "credit score loans interest"],
    ],
  },
  {
    slug: "fitness-sports",
    name: "Fitness and sports",
    rules: { formats: ["in_person", "live"], minTrust: 0, waiver: true },
    skills: [
      ["running-form", "Running form", "running jogging marathon technique"],
      ["climbing", "Climbing", "bouldering climbing technique"],
      ["tennis", "Tennis", "tennis serve forehand"],
      ["swimming", "Swimming technique", "swim freestyle breaststroke"],
      ["strength-training", "Strength training", "gym weights lifting workout"],
    ],
  },
  {
    slug: "mind-wellness",
    name: "Mind and wellness",
    rules: { formats: ["live", "group"], minTrust: 0, notes: "No therapy or medical claims" },
    skills: [
      ["yoga", "Yoga", "yoga stretching flexibility"],
      ["meditation", "Meditation", "mindfulness calm focus"],
      ["breathing", "Breathing techniques", "breathwork breathing relaxation"],
    ],
  },
  {
    slug: "cooking-food",
    name: "Cooking and food",
    rules: { formats: ["live", "group", "in_person"], minTrust: 0, notes: "Allergy note on booking" },
    skills: [
      ["home-cooking", "Home cooking", "recipes dinner cooking basics"],
      ["baking", "Baking", "bread cakes pastry sourdough"],
      ["knife-skills", "Knife skills", "chopping knife technique"],
      ["meal-prep", "Meal prep", "meal planning batch cooking healthy"],
    ],
  },
  {
    slug: "home-diy",
    name: "Home and DIY",
    rules: {
      formats: ["in_person", "live"],
      minTrust: 0,
      notes: "No work that needs a license (electrical, gas, structural)",
    },
    skills: [
      ["furniture-assembly", "Furniture assembly", "ikea assembly flatpack"],
      ["painting-walls", "Painting walls", "paint walls decorating"],
      ["basic-repairs", "Basic repairs", "fix repair tools leaks shelves"],
    ],
  },
  {
    slug: "garden-outdoors",
    name: "Garden and outdoors",
    rules: { formats: ["in_person", "live"], minTrust: 0 },
    skills: [
      ["gardening", "Gardening", "plants vegetables garden"],
      ["composting", "Composting", "compost soil"],
      ["hiking", "Hiking basics", "hiking trails navigation outdoors"],
    ],
  },
  {
    slug: "vehicles-bikes",
    name: "Vehicles and bikes",
    rules: { formats: ["in_person", "live"], minTrust: 0, notes: "Teaching only, no paid repair work" },
    skills: [
      ["bike-repair", "Bike repair", "bicycle flat tire gears chain"],
      ["car-basics", "Car basics", "car maintenance oil tires checks"],
    ],
  },
  {
    slug: "tech-help",
    name: "Tech help",
    rules: { formats: ["live", "in_person"], minTrust: 0, notes: "Never ask for passwords" },
    skills: [
      ["phone-setup", "Phone setup", "iphone android smartphone apps"],
      ["laptop-setup", "Laptop setup", "computer mac windows setup"],
      ["privacy-settings", "Privacy settings", "privacy security settings accounts"],
    ],
  },
  {
    slug: "crafts-making",
    name: "Crafts and making",
    rules: { formats: ["live", "in_person", "group"], minTrust: 0 },
    skills: [
      ["sewing", "Sewing", "sewing machine clothes alterations"],
      ["knitting", "Knitting", "knit crochet yarn"],
      ["woodworking", "Woodworking", "wood carpentry tools"],
      ["3d-printing", "3D printing", "3d printer cad filament"],
    ],
  },
  {
    slug: "style-beauty",
    name: "Style and beauty",
    rules: { formats: ["live", "in_person"], minTrust: 0, notes: "No licensed cosmetology services" },
    skills: [
      ["styling", "Personal styling", "outfits fashion wardrobe"],
      ["makeup", "Makeup basics", "makeup cosmetics"],
    ],
  },
  {
    slug: "games-hobbies",
    name: "Games and hobbies",
    rules: { formats: ["live", "group", "in_person"], minTrust: 0, notes: "No gambling" },
    skills: [
      ["chess", "Chess", "chess openings tactics endgames"],
      ["board-games", "Board games", "board games strategy"],
      ["puzzles", "Puzzles", "rubiks cube puzzles crosswords"],
    ],
  },
  {
    slug: "helping-hands",
    name: "Helping hands",
    rules: { formats: ["in_person", "async"], minTrust: 2 },
    skills: [
      ["moving-help", "Moving help", "moving boxes carry"],
      ["pet-sitting", "Pet sitting", "pets dog cat walking"],
      ["plant-care", "Plant care", "houseplants watering"],
      ["proofreading", "Proofreading", "proofread typos editing"],
    ],
  },
];
