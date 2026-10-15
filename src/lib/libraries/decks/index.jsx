// AcademyCode (décision D1-a du 15/10/2026) : les tutoriels de scratch-gui ne sont plus livrés. Le menu ne les
// proposait déjà plus (test fork-guards) ; leurs ≈ 1 500 images (66 Mo, dont des photos de personnes réelles) partaient
// pourtant dans le paquet publié. On garde les catégories, importées par la bibliothèque de sprites,
// et une liste vide : ?tutorial=… n'ouvre plus rien.
export const CATEGORIES = {
    gettingStarted: 'gettingStarted',
    basics: 'basics',
    intermediate: 'intermediate',
    prompts: 'prompts'
};

export default {};
