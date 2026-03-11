export interface SubredditConfig {
  name: string;
  minScore: number;
  excludeTerms: string[];
  searchTerms: string[];
  aiFocused?: boolean;
}

const toConfig = (
  name: string,
  minScore: number,
  aiFocused: boolean,
): SubredditConfig => ({
  name,
  minScore,
  excludeTerms: [],
  searchTerms: [],
  aiFocused,
});

const coreAISubreddits = [
  "StableDiffusion",
  "midjourney",
  "sdforall",
  "aivideo",
  "aivideos",
  "aihub",
  "aiArt",
  "NanoBanana",
  "Veo3",
  "Dalle2",
  "LeonardiAI",
  "HiggsfieldAI",
  "KlingAIVideos",
  "AIGeneratedArt",
  "AIImages",
  "aislop",
];

const adultAISubreddits = [
  "Grok_Porn",
  "ai_GOONING",
  "AiPornhubvideo",
  "ai_xxx_porn",
  "RealisticAIPorn",
  "Creative_AI_Porn",
  "ai_porn_gallery",
  "AIpornhub",
  "ARTificialNSFW",
  "AIPornVideoHub",
  "Nasty_AI_Porn",
  "AIporn",
  "AI_hardcorePORN",
  "Best_AI_Porn_",
  "AI_Porn_Generator_",
  "aipornisthefuture",
  "ai_porn_pics_no_limit",
  "ai_porn_gif",
  "AIPornGoon",
  "AIPornBabes",
  "AIGeneratedPorno",
  "AiUncensored",
  "AI_Girls_NSFW",
  "NextGenPornByAI",
  "FakeAiPorn",
  "AIPornFun",
  "surreal_ai_porn",
  "REALinhumanAiPorn",
  "AIPornShorts",
  "AIPornAnime",
  "CartoonPorn_AI",
  "Artfull_AI_Porn",
  "AiPornLover",
  "stablediffusionporn",
  "anal_ai_porn",
  "AiPorn_Generator",
  "interracial_ai_porn",
  "AiPornNudes",
  "AiPornRealm",
  "AI_PornStars",
  "AI_porn_clips",
  "unstable_diffusion",
  "FuckAI",
  "sdnsfw",
  "Ai_Porn_Gifs",
  "Hentai_Porn_AI",
  "CreateShemaleAI",
  "aigirls",
  "Viceboys_AiPorn",
  "Chubby_AI_porn",
  "AiBiPorn",
  "pornclip",
  "AI_Pornzone",
  "BustyAIBabes",
  "Dispatch_porn_anti_AI",
  "aichatandporn",
  "AIPornHouse",
  "SatinLingeriePornAI",
  "ebony_ai_porn",
  "AI_fit_porn",
  "AIPornGirl",
  "aiporngeneratorsX",
  "AIpornnsfwart",
  "AIPorn_Premium",
  "AIporn_Promotions",
  "AIPornWithSound",
  "invincible_porn_no_ai",
  "AILesbianPorn",
  "BBCAIPorn",
  "AnimeAIPorn",
  "DesiAICurated",
  "DesiAIMasala",
  "DesiAdultfusion",
];

const generalSubreddits: SubredditConfig[] = [
  toConfig("chatGPT", 30, false),
  toConfig("nextfuckinglevel", 30, false),
  toConfig("damnthatsinteresting", 30, false),
  toConfig("interestingasfuck", 30, false),
  toConfig("singularity", 30, false),
  toConfig("crazyfuckingvideos", 30, false),
];

const uniqueNames = new Set<string>();
const dedupeByName = (items: SubredditConfig[]): SubredditConfig[] =>
  items.filter((item) => {
    const key = item.name.toLowerCase();
    if (uniqueNames.has(key)) return false;
    uniqueNames.add(key);
    return true;
  });

export const subreddits: SubredditConfig[] = dedupeByName([
  ...coreAISubreddits.map((name) => toConfig(name, 30, true)),
  ...adultAISubreddits.map((name) => toConfig(name, 30, true)),
  ...generalSubreddits,
]);
