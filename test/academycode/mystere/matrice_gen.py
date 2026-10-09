# Matrice de projets de référence pour la vérification du comportement (« La machine qui accélère »).
# Chaque projet est écrit ici, puis réenregistré par la scratch-vm du fork (vm-mystere.cjs --sauver), et rangé dans les
# fixtures du fork avec son classement attendu (manifest.json). Dessins propres, aucun asset tiers.
import hashlib, json, sys, zipfile, itertools

OUT = sys.argv[1]
FOND = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#0f172a"/></svg>'
ROND = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="#b45309"/></svg>'
NEF = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><polygon points="20,0 40,30 0,30" fill="#38bdf8"/></svg>'
md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
cpt = itertools.count()


class Script:
    """Petite fabrique de blocs Scratch 3 (project.json), assez pour la matrice."""

    def __init__(self):
        self.blocs = {}

    def b(self, opcode, inputs=None, fields=None, parent=None):
        i = f'b{next(cpt)}'
        self.blocs[i] = {'opcode': opcode, 'next': None, 'parent': parent, 'inputs': inputs or {}, 'fields': fields or {}, 'shadow': False, 'topLevel': False}
        return i

    def pile(self, chapeau, *ids, pos=(0, 0)):
        """Enchaîne des blocs sous un chapeau ; renvoie l'id du chapeau."""
        self.blocs[chapeau].update(topLevel=True, x=pos[0], y=pos[1])
        prec = chapeau
        for i in ids:
            self.blocs[prec]['next'] = i
            self.blocs[i]['parent'] = prec
            prec = i
        return chapeau

    def corps(self, *ids):
        """Une sous-pile (SUBSTACK) ; renvoie son premier bloc."""
        for a, c in zip(ids, ids[1:]):
            self.blocs[a]['next'] = c
            self.blocs[c]['parent'] = a
        return ids[0]

    def accroche(self, parent, cle, enfant, ombre=None):
        self.blocs[enfant]['parent'] = parent
        self.blocs[parent]['inputs'][cle] = [2, enfant] if ombre is None else [3, enfant, ombre]
        return parent


def nombre(v):
    return [1, [4, str(v)]]


class Projet:
    def __init__(self, noms):
        """noms : {nom affiché: (id, cible)} ; cible None = pour tous les sprites (scène)."""
        self.vars = noms
        self.sprites = []

    affiche = {}

    def nom(self, n):
        return self.affiche.get(n, n)

    def var(self, nom):
        vid, _ = self.vars[nom]
        return [3, [12, self.nom(nom), vid], [4, '0']]

    def champ(self, nom):
        return {'VARIABLE': [self.nom(nom), self.vars[nom][0]]}

    def sprite(self, nom, script, cache=False, y=170, svg=ROND):
        self.sprites.append((nom, script, cache, y, svg))

    def ecrire(self, chemin):
        fond, rond, nef = md5(FOND), md5(ROND), md5(NEF)
        cibles = [{'isStage': True, 'name': 'Stage', 'variables': {vid: [self.nom(n), 0] for n, (vid, c) in self.vars.items() if c is None},
                   'lists': {}, 'broadcasts': {'msg-debut': 'début'}, 'blocks': {}, 'comments': {}, 'currentCostume': 0,
                   'costumes': [{'name': 'ciel', 'dataFormat': 'svg', 'assetId': fond, 'md5ext': f'{fond}.svg', 'rotationCenterX': 240, 'rotationCenterY': 180}],
                   'sounds': [], 'volume': 100, 'layerOrder': 0, 'tempo': 60, 'videoTransparency': 50, 'videoState': 'on', 'textToSpeechLanguage': None}]
        for k, (nom, s, cache, y, svg) in enumerate(self.sprites):
            h = md5(svg)
            cibles.append({'isStage': False, 'name': nom, 'variables': {vid: [self.nom(n), 0] for n, (vid, c) in self.vars.items() if c == nom},
                           'lists': {}, 'broadcasts': {}, 'blocks': s.blocs, 'comments': {}, 'currentCostume': 0,
                           'costumes': [{'name': nom, 'dataFormat': 'svg', 'assetId': h, 'md5ext': f'{h}.svg', 'rotationCenterX': 20, 'rotationCenterY': 20}],
                           'sounds': [], 'volume': 100, 'layerOrder': k + 1, 'visible': not cache, 'x': 0, 'y': y, 'size': 100, 'direction': 90,
                           'draggable': False, 'rotationStyle': 'all around'})
        projet = {'targets': cibles, 'monitors': [], 'extensions': [], 'meta': {'semver': '3.0.0', 'vm': '5.0.300', 'agent': 'AcademyCode, matrice de référence'}}
        with zipfile.ZipFile(chemin, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('project.json', json.dumps(projet, ensure_ascii=False))
            for svg in {FOND, ROND, NEF}:
                z.writestr(f'{md5(svg)}.svg', svg)


def regle_niveau(P, s, op='gt', palier=None):
    """« si score > niveau × 10 alors ajouter 1 à niveau » ; variantes : « non (score < niveau × 10 + 1) », « ≥ », palier figé."""
    def droite(parent_cle):
        if palier is not None:
            return [1, [10, str(palier)]], None
        mul = s.b('operator_multiply', {'NUM1': P.var('niveau'), 'NUM2': nombre(10)})
        return [3, mul, [10, '']], mul
    if op == 'gt':
        d, mul = droite(None)
        cond = s.b('operator_gt', {'OPERAND1': P.var('score'), 'OPERAND2': d})
        if mul: s.blocs[mul]['parent'] = cond
    elif op == 'non-inf-plus-1':
        mul = s.b('operator_multiply', {'NUM1': P.var('niveau'), 'NUM2': nombre(10)})
        plus = s.b('operator_add', {'NUM1': [3, mul, [4, '']], 'NUM2': nombre(1)})
        s.blocs[mul]['parent'] = plus
        inf = s.b('operator_lt', {'OPERAND1': P.var('score'), 'OPERAND2': [3, plus, [10, '']]})
        s.blocs[plus]['parent'] = inf
        cond = s.b('operator_not', {'OPERAND': [2, inf]})
        s.blocs[inf]['parent'] = cond
    else:  # 'ge' : non (score < palier)
        d, mul = droite(None)
        inf = s.b('operator_lt', {'OPERAND1': P.var('score'), 'OPERAND2': d})
        if mul: s.blocs[mul]['parent'] = inf
        cond = s.b('operator_not', {'OPERAND': [2, inf]})
        s.blocs[inf]['parent'] = cond
    monte = s.b('data_changevariableby', {'VALUE': nombre(1)}, P.champ('niveau'))
    si = s.b('control_if', {'CONDITION': [2, cond], 'SUBSTACK': [2, monte]})
    s.blocs[cond]['parent'] = si
    s.blocs[monte]['parent'] = si
    return si


def chute(P, s, fixe=None):
    """« ajouter (0 - (2 + niveau)) à y » ; fixe = vitesse figée."""
    if fixe is not None:
        return s.b('motion_changeyby', {'DY': nombre(-fixe)})
    somme = s.b('operator_add', {'NUM1': nombre(2), 'NUM2': P.var('niveau')})
    opp = s.b('operator_subtract', {'NUM1': nombre(0), 'NUM2': [3, somme, [4, '']]})
    s.blocs[somme]['parent'] = opp
    ch = s.b('motion_changeyby', {'DY': [3, opp, [4, '0']]})
    s.blocs[opp]['parent'] = ch
    return ch


def remonter_si_bas(P, s):
    ordo = s.b('motion_yposition')
    inf = s.b('operator_lt', {'OPERAND1': [3, ordo, [10, '']], 'OPERAND2': [1, [10, '-170']]})
    s.blocs[ordo]['parent'] = inf
    haut = s.b('motion_sety', {'Y': nombre(170)})
    si = s.b('control_if', {'CONDITION': [2, inf], 'SUBSTACK': [2, haut]})
    s.blocs[inf]['parent'] = si
    s.blocs[haut]['parent'] = si
    return si


def init(P, s, niveau_depart=1):
    return [s.b('data_setvariableto', {'VALUE': [1, [10, '0']]}, P.champ('score')), s.b('data_setvariableto', {'VALUE': [1, [10, str(niveau_depart)]]}, P.champ('niveau'))]


def boucle(s, *corps):
    return s.b('control_forever', {'SUBSTACK': [2, s.corps(*corps)]})


def fix_boucle(s, b):
    first = s.blocs[b]['inputs']['SUBSTACK'][1]
    s.blocs[first]['parent'] = b
    return b


def projet_simple(nom, op='gt', palier=None, fixe=None, glob=True, majuscule=False, sans_chute=False, au_clic=False, niveau_depart=1):
    """Un seul météore qui porte tout (comme la machine), avec des variantes."""
    P = Projet({'score': ('v-score', None), 'niveau': ('v-niveau', None if glob else 'Météore')})
    if majuscule:
        P.affiche = {'score': 'Score'}
    s = Script()
    corps = [regle_niveau(P, s, op, palier)]
    if not sans_chute:
        corps += [chute(P, s, fixe), remonter_si_bas(P, s)]
    b = fix_boucle(s, boucle(s, *corps))
    chap = s.b('event_whenthisspriteclicked' if au_clic else 'event_whenflagclicked')
    s.pile(chap, *init(P, s, niveau_depart), b)
    P.sprite('Météore', s)
    P.ecrire(f'{OUT}/{nom}.sb3')


def projet_enfant(nom, message=False, attente_boucle=False, regle_au_score=False, deux_scores=False):
    """Comme le jeu d'un enfant : un vaisseau porte la règle de niveau ; un météore caché fait tomber des clones, créés avec une
    attente au hasard et une position au hasard ; le score change à la touche espace."""
    noms = {'score': ('v-score', None), 'niveau': ('v-niveau', None)}
    if deux_scores:
        noms['score '] = ('v-score2', 'Vaisseau')  # une seconde variable « score » (pour ce sprite uniquement)
    P = Projet(noms)
    v = Script()
    plus1 = v.b('data_changevariableby', {'VALUE': nombre(1)}, P.champ('score'))
    corps_touche = [plus1]
    if regle_au_score:
        corps_touche.append(regle_niveau(P, v))
    v.pile(v.b('event_whenkeypressed', fields={'KEY_OPTION': ['space', None]}), *corps_touche, pos=(300, 0))
    if not regle_au_score:
        b = fix_boucle(v, boucle(v, regle_niveau(P, v)))
        if message:
            env = v.b('event_broadcast', {'BROADCAST_INPUT': [1, [11, 'début', 'msg-debut']]})
            v.pile(v.b('event_whenflagclicked'), *init(P, v), env)
            v.pile(v.b('event_whenbroadcastreceived', fields={'BROADCAST_OPTION': ['début', 'msg-debut']}), b, pos=(0, 300))
        else:
            v.pile(v.b('event_whenflagclicked'), *init(P, v), b)
    else:
        v.pile(v.b('event_whenflagclicked'), *init(P, v))
    if deux_scores:
        v.pile(v.b('event_whenflagclicked'), v.b('data_setvariableto', {'VALUE': [1, [10, '0']]}, {'VARIABLE': ['score', 'v-score2']}), pos=(600, 0))
    P.sprite('Vaisseau', v, y=-150, svg=NEF)
    m = Script()
    hasard_att = m.b('operator_random', {'FROM': nombre(0.2), 'TO': nombre(0.6)})
    att = m.b('control_wait', {'DURATION': [3, hasard_att, [5, '1']]})
    m.blocs[hasard_att]['parent'] = att
    clone = m.b('control_create_clone_of', {'CLONE_OPTION': [1, 'menu']})
    menu = m.b('control_create_clone_of_menu', fields={'CLONE_OPTION': ['_myself_', None]})
    m.blocs[menu]['shadow'] = True
    m.blocs[menu]['parent'] = clone
    m.blocs[clone]['inputs']['CLONE_OPTION'] = [1, menu]
    m.pile(m.b('event_whenflagclicked'), m.b('looks_hide'), fix_boucle(m, boucle(m, att, clone)), pos=(0, 0))
    hx = m.b('operator_random', {'FROM': nombre(-200), 'TO': nombre(200)})
    aller = m.b('motion_gotoxy', {'X': [3, hx, [4, '0']], 'Y': nombre(170)})
    m.blocs[hx]['parent'] = aller
    corps = [chute(P, m)]
    if attente_boucle:
        corps.append(m.b('control_wait', {'DURATION': nombre(0)}))
    ordo = m.b('motion_yposition')
    inf = m.b('operator_lt', {'OPERAND1': [3, ordo, [10, '']], 'OPERAND2': [1, [10, '-170']]})
    m.blocs[ordo]['parent'] = inf
    suppr = m.b('control_delete_this_clone')
    si = m.b('control_if', {'CONDITION': [2, inf], 'SUBSTACK': [2, suppr]})
    m.blocs[inf]['parent'] = si
    m.blocs[suppr]['parent'] = si
    corps.append(si)
    m.pile(m.b('control_start_as_clone'), aller, m.b('looks_show'), fix_boucle(m, boucle(m, *corps)), pos=(0, 300))
    P.sprite('Météore', m, cache=True)
    P.ecrire(f'{OUT}/{nom}.sb3')


def projet_sans_niveau(nom):
    """Le jeu tel qu'il est avant la leçon : le météore tombe, le score existe, pas encore de variable « niveau »."""
    P = Projet({'score': ('v-score', None)})
    s = Script()
    b = fix_boucle(s, boucle(s, s.b('motion_changeyby', {'DY': nombre(-2)}), remonter_si_bas(P, s)))
    s.pile(s.b('event_whenflagclicked'), s.b('data_setvariableto', {'VALUE': [1, [10, '0']]}, P.champ('score')), b)
    P.sprite('Météore', s)
    P.ecrire(f'{OUT}/{nom}.sb3')


matrice = {
    'juste-1-comme-la-machine': ('conforme', lambda n: projet_simple(n)),
    'juste-2-non-inferieur-plus-un': ('conforme', lambda n: projet_simple(n, op='non-inf-plus-1')),
    'juste-3-niveau-du-sprite': ('conforme', lambda n: projet_simple(n, glob=False)),
    'juste-4-majuscule': ('conforme', lambda n: projet_simple(n, majuscule=True)),
    'juste-5-clones-attentes-hasard': ('conforme', lambda n: projet_enfant(n)),
    'juste-6-message-de-depart': ('conforme', lambda n: projet_enfant(n, message=True)),
    'juste-7-attendre-dans-la-boucle': ('conforme', lambda n: projet_enfant(n, attente_boucle=True)),
    'faux-1-superieur-ou-egal': ('different', lambda n: projet_simple(n, op='ge')),
    'faux-2-palier-fige': ('different', lambda n: projet_simple(n, palier=10)),
    'faux-3-vitesse-figee': ('different', lambda n: projet_simple(n, fixe=3)),
    # Trouvé par simulation (09/10) : la remise à « niveau 1 » avant chaque score masquait un niveau de départ différent.
    'faux-4-niveau-de-depart': ('different', lambda n: projet_simple(n, niveau_depart=0)),
    'limite-1-regle-au-moment-du-point': ('impossible', lambda n: projet_enfant(n, regle_au_score=True)),
    'limite-2-rien-ne-tombe': ('impossible', lambda n: projet_simple(n, sans_chute=True)),
    'limite-3-demarre-au-clic': ('impossible', lambda n: projet_simple(n, au_clic=True)),
    'limite-4-deux-variables-score': ('impossible', lambda n: projet_enfant(n, deux_scores=True)),
    'limite-5-sans-variable-niveau': ('impossible', projet_sans_niveau),
}
for nom, (attendu, f) in matrice.items():
    f(nom)
json.dump({n: a for n, (a, _) in matrice.items()}, open(f'{OUT}/manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(matrice), 'projets écrits')
