import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {getIsShowingProject} from '../../reducers/project-state';
import AutoSaver from './autosave.js';
import {
    lessonId, isChallenge, fetchProject, putProject, fetchConsignes, mysteryId, fetchMystery, NETWORK_MESSAGE,
    comparedMysteryId, fetchMysteryConfig, restartProject
} from './api.js';
import {observer, comparer, message as messageComportement} from './comportement.mjs';
import {borner, deplacer, lire as lirePosition, ecrire as ecrirePosition} from './panneau-position.js';
import {disponible as pleinEcranDisponible, actif as pleinEcranActif, basculer, sortir, EVENEMENTS}
    from './plein-ecran.js';

const PERIOD_MS = 30000;

// Dans la barre de menus, à droite (vide à cet endroit) : rien ne recouvre l'ajout de sprite
// ni les boutons de zoom.
const BAR_STYLE = {
    position: 'fixed',
    right: 8,
    top: 6,
    zIndex: 1000,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    font: '600 14px sans-serif'
};
// Le message de vérification : vert quand la leçon est validée, neutre sinon.
const NOTICE_STYLE = reussi => ({
    position: 'fixed',
    right: 8,
    // Sous les boutons de taille de la scène (jusqu'à 92 px), qui restent cliquables.
    top: 100,
    zIndex: 1001,
    maxWidth: 320,
    padding: '10px 12px',
    background: reussi ? '#e8f7ee' : '#fff',
    border: `1px solid ${reussi ? '#3aa76d' : '#d9d9d9'}`,
    borderRadius: 8,
    font: '14px sans-serif',
    lineHeight: 1.4,
    color: reussi ? '#14532d' : '#333'
});

// Juste à droite de la palette (qui finit à 312 px) : les catégories que les consignes
// demandent d'utiliser restent visibles. 260 px tiennent dans la zone de code à 1024 px.
const PANEL_STYLE = {
    position: 'fixed',
    left: 320,
    // Sous la barre de menus et les onglets Code/Costumes/Sons, qui doivent rester cliquables.
    top: 92,
    zIndex: 1000,
    width: 260,
    maxHeight: 'calc(100vh - 120px)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(0,0,0,.15)',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 8,
    font: 'inherit',
    fontSize: 14,
    lineHeight: 1.4,
    color: '#222'
};
const PANEL_LARGEUR = PANEL_STYLE.width;
// Bandeau à saisir pour déplacer le panneau (souris, doigt, stylet) : sans défilement ni sélection pendant le geste.
const BANDEAU_STYLE = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 6px 6px 12px',
    background: '#4f46e5',
    color: '#fff',
    borderRadius: '7px 7px 0 0',
    cursor: 'move',
    touchAction: 'none',
    userSelect: 'none',
    fontWeight: 600
};
// Focus clavier bien visible sur le bandeau (contour ambre, comme ailleurs dans AcademyCode).
const BANDEAU_FOCUS_STYLE = {...BANDEAU_STYLE, outline: '3px solid #ffb21e', outlineOffset: -3};
const FERMER_STYLE = {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    border: 0,
    borderRadius: 999,
    background: 'transparent',
    color: '#fff',
    font: '700 18px sans-serif',
    lineHeight: 1,
    cursor: 'pointer'
};
const CORPS_STYLE = {padding: '8px 12px 10px', overflowY: 'auto'};

// Bouton principal aux couleurs d'AcademyCode (brand-600), secondaires discrets sur le violet du menu.
const BUTTON_STYLE = {
    background: '#fff',
    color: '#4f46e5',
    border: '1px solid #fff',
    borderRadius: 999,
    padding: '6px 14px',
    font: 'inherit',
    cursor: 'pointer'
};
const BUTTON_SUITE = {...BUTTON_STYLE, marginTop: 8, background: '#3aa76d', borderColor: '#3aa76d', color: '#fff'};
// Leçon terminée mais comportement non conforme (ou non vérifiable) : on peut continuer, sans signal de réussite.
const BUTTON_SUITE_NEUTRE = {...BUTTON_STYLE, marginTop: 8, borderColor: '#d9d9d9'};
const BUTTON_SECONDAIRE = {
    ...BUTTON_STYLE,
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.6)'
};

/**
 * Relie l'éditeur à AcademyCode : recharge le projet de l'enfant, le sauvegarde toutes les 30 s s'il est modifié,
 * et propose « Vérifier mon projet » (sauvegarde puis message du serveur : c'est l'état utilisé pour la progression).
 * Sans `?lecon=` dans l'URL, l'éditeur reste un éditeur simple, sans sauvegarde.
 * @param {React.Component} WrappedComponent - l'éditeur à envelopper
 * @returns {React.Component} l'éditeur relié à AcademyCode
 */
const BridgeHOC = function (WrappedComponent) {
    class Bridge extends React.Component {
        constructor (props) {
            super(props);
            // Lecteur d'un programme mystère : ni leçon, ni projet d'enfant, ni sauvegarde ;
            // seulement le projet publié.
            this.mystery = mysteryId();
            this.lesson = this.mystery ? null : lessonId();
            // Leçon à programme mystère : « Vérifier » compare aussi le comportement (étape 2 du pilote).
            this.compare = this.lesson ? comparedMysteryId() : null;
            // Défi : la mission est écrite sur la page ; la bulle fermée laisse voir toute la palette.
            this.challenge = isChallenge(this.lesson);
            this.retour = this.challenge ? 'Retour au défi' : 'Retour à la leçon';
            // Sans plein écran possible (navigateur, ou iframe sans allowfullscreen) : pas de bouton qui ne fait rien.
            this.pleinEcran = pleinEcranDisponible(document);
            this.started = false;
            this.state = {
                message: '',
                comportement: '',
                busy: false,
                fullscreen: false,
                consignes: null,
                panneau: !this.challenge,
                // Position choisie par l'enfant pour cette leçon (null : place par défaut, à droite de la palette).
                position: this.lesson ? lirePosition(window.localStorage, this.lesson) : null,
                termine: false,
                confirmer: false,
                conforme: null
            };
            this.saver = new AutoSaver({
                save: () => this.save(),
                periodMs: PERIOD_MS,
                onError: error => this.setState({message: error.message || NETWORK_MESSAGE})
            });
            this.handleChanged = () => this.saver.markDirty();
            this.handleHidden = () => {
                // Best effort : le navigateur ne garantit pas une requête émise pendant la fermeture.
                if (document.visibilityState === 'hidden') this.saver.tick();
            };
            this.handleVerify = this.handleVerify.bind(this);
            this.handleFullscreen = this.handleFullscreen.bind(this);
            this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
            this.handlePanneau = this.handlePanneau.bind(this);
            this.handleSaisie = this.handleSaisie.bind(this);
            this.handleDeplacement = this.handleDeplacement.bind(this);
            this.handleLacher = this.handleLacher.bind(this);
            this.handleClavier = this.handleClavier.bind(this);
            this.handleFermer = this.handleFermer.bind(this);
            // Fenêtre redimensionnée : on redessine, et le panneau est ramené dans la fenêtre (borné au rendu).
            this.handleResize = () => this.forceUpdate();
            this.handleBandeauFocus = () => this.setState({bandeauFocus: true});
            this.handleBandeauBlur = () => this.setState({bandeauFocus: false});
            this.boutonConsignes = React.createRef();
            this.handleSuite = this.handleSuite.bind(this);
            this.handleRestartAsk = () => this.setState({confirmer: true});
            this.handleRestartCancel = () => this.setState({confirmer: false});
            this.handleRestart = this.handleRestart.bind(this);
        }

        componentDidUpdate () {
            if (this.mystery && !this.started && this.props.ready) {
                this.started = true;
                fetchMystery(this.mystery)
                    .then(buffer => this.props.vm.loadProject(buffer))
                    .catch(error => this.setState({message: error.message}));
            }
            if (this.lesson && !this.started && this.props.ready) {
                this.started = true;
                this.begin();
            }
        }

        componentWillUnmount () {
            this.saver.stop();
            for (const nom of EVENEMENTS) document.removeEventListener(nom, this.handleFullscreenChange);
            document.removeEventListener('visibilitychange', this.handleHidden);
            window.removeEventListener('pagehide', this.handleHidden);
            window.removeEventListener('resize', this.handleResize);
            if (this.props.vm) this.props.vm.off('PROJECT_CHANGED', this.handleChanged);
        }

        async begin () {
            try {
                const projet = await fetchProject(this.lesson);
                if (projet) {
                    await this.props.vm.loadProject(projet.buffer);
                    // Projet de départ d'un défi : rien n'a été « rechargé », on ne dit rien.
                    if (!projet.depart) this.setState({message: 'Ton projet a été rechargé.'});
                }
            } catch (error) {
                this.setState({message: error.message});
            }
            fetchConsignes(this.lesson)
                .then(consignes => this.setState({consignes}))
                .catch(() => {});
            this.saver.markClean();
            this.props.vm.on('PROJECT_CHANGED', this.handleChanged);
            for (const nom of EVENEMENTS) document.addEventListener(nom, this.handleFullscreenChange);
            document.addEventListener('visibilitychange', this.handleHidden);
            window.addEventListener('pagehide', this.handleHidden);
            window.addEventListener('resize', this.handleResize);
            this.saver.start();
        }

        async save () {
            const blob = await this.props.vm.saveProjectSb3();
            // L'intention « vérifier » est posée par handleVerify et consommée ici, une fois.
            const verify = this.verifying === true;
            this.verifying = false;
            const data = await putProject(this.lesson, blob, verify);
            // Succès : on efface un éventuel message de coupure réseau, sinon l'enfant
            // continue de lire « la connexion est coupée » alors que tout est sauvegardé.
            this.setState({message: 'Projet sauvegardé.', busy: false});
            return data;
        }

        // Plein écran natif : l'éditeur Scratch est à l'étroit dans l'iframe de la leçon.
        // Nécessite allowfullscreen sur l'iframe côté AcademyCode.
        // API standard ou préfixée webkit (anciens Safari d'iPad) : voir plein-ecran.js.
        handleFullscreen () {
            basculer(document);
        }

        // Ramène l'enfant à la page de la leçon (quiz, bouton « Leçon terminée »),
        // qui est sous l'iframe : on sort du plein écran et la page fait défiler.
        handleSuite () {
            sortir(document);
            window.parent.postMessage({academycode: 'lecon-terminee'}, window.location.origin);
        }

        handlePanneau () {
            this.setState(state => ({panneau: !state.panneau}));
        }

        // Déplacement du panneau par son bandeau : le pointeur est capturé, le panneau reste dans la fenêtre,
        // et la position est gardée pour cette leçon au lâcher.
        handleSaisie (event) {
            if (event.button !== 0 || event.target.closest('button')) return;
            const cadre = event.currentTarget.parentElement.getBoundingClientRect();
            this.saisie = {dx: event.clientX - cadre.left, dy: event.clientY - cadre.top};
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
        }

        handleDeplacement (event) {
            if (!this.saisie) return;
            this.setState({position: borner(
                {x: event.clientX - this.saisie.dx, y: event.clientY - this.saisie.dy},
                PANEL_LARGEUR,
                {w: window.innerWidth, h: window.innerHeight}
            )});
        }

        handleLacher () {
            if (!this.saisie) return;
            this.saisie = null;
            if (this.state.position) ecrirePosition(window.localStorage, this.lesson, this.state.position);
        }

        // Fermer (croix ou Échap) : le focus revient au bouton qui rouvre les consignes, l'enfant ne se perd pas.
        handleFermer () {
            this.setState({panneau: false}, () => {
                if (this.boutonConsignes.current) this.boutonConsignes.current.focus();
            });
        }

        // Clavier : Échap ferme ; sur le bandeau, les flèches déplacent (10 px, 50 px avec Maj).
        handleClavier (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.handleFermer();
                return;
            }
            if (!event.target.hasAttribute('data-panneau-bandeau')) return;
            const cadre = event.currentTarget.getBoundingClientRect();
            const voulue = deplacer({x: cadre.left, y: cadre.top}, event.key, event.shiftKey);
            if (!voulue) return;
            event.preventDefault();
            const position = borner(voulue, PANEL_LARGEUR, {w: window.innerWidth, h: window.innerHeight});
            this.setState({position});
            ecrirePosition(window.localStorage, this.lesson, position);
        }

        stylePanneau () {
            if (!this.state.position) return PANEL_STYLE;
            const {x, y} = borner(this.state.position, PANEL_LARGEUR, {w: window.innerWidth, h: window.innerHeight});
            return {...PANEL_STYLE, left: x, top: y};
        }

        // Le navigateur quitte le plein écran de lui-même dès qu'il ouvre une fenêtre système
        // (import d'une image, par exemple) : on le dit à l'enfant plutôt que de le laisser deviner.
        handleFullscreenChange () {
            const fullscreen = pleinEcranActif(document);
            const sorti = this.state.fullscreen && !fullscreen;
            this.setState({
                fullscreen,
                message: sorti && !this.state.termine ?
                    'Tu es revenu à la leçon. Clique sur « Plein écran » pour agrandir à nouveau.' :
                    this.state.message
            });
        }

        async handleVerify () {
            this.setState({busy: true, message: 'Vérification en cours…', comportement: '', conforme: null});
            try {
                this.verifying = true;
                const data = await this.saver.flush(true);
                if (!this.compare) {
                    this.setState({busy: false, message: data.message, termine: Boolean(data.completed)});
                    return;
                }
                this.setState({message: `Structure : ${data.message}`, comportement: 'Comportement : test en cours…'});
                const {texte, conforme} = await this.comportement();
                this.setState({
                    busy: false,
                    comportement: `Comportement : ${texte}`,
                    conforme,
                    termine: Boolean(data.completed)
                });
            } catch (error) {
                this.setState({busy: false, message: error.message});
            }
        }

        // Vert seulement si tout ce qui a été vérifié va bien : dans une leçon à programme mystère, la leçon peut être
        // terminée (structure et quiz) alors que le comportement diffère ; le message ne doit pas dire le contraire.
        vert () {
            return this.state.termine && (!this.compare || this.state.conforme === true);
        }

        // Étape 2 du pilote : le jeu de l'enfant et la machine mystère tournent chacun dans une VM à part, sans rendu ;
        // on compare ce qu'ils font pour une liste de scores. Rien n'est enregistré : c'est un retour pour l'enfant.
        async comportement () {
            try {
                const [machineSb3, config, blob] = await Promise.all([
                    fetchMystery(this.compare), fetchMysteryConfig(this.compare), this.props.vm.saveProjectSb3()
                ]);
                const storage = this.props.vm.runtime.storage;
                const machine = await observer(machineSb3, config, storage);
                const enfant = await observer(await blob.arrayBuffer(), config, storage);
                const resultat = comparer(machine, enfant);
                return {texte: messageComportement(resultat, config), conforme: resultat.verdict === 'conforme'};
            } catch (error) {
                return {
                    texte: 'vérification impossible pour l’instant. Ce n’est pas forcément une erreur de ton jeu : ' +
                        'compare-le toi-même à la machine.',
                    conforme: false
                };
            }
        }

        // Défi : repartir du projet de départ, après confirmation. L'auto-sauvegarde est arrêtée et attendue d'abord,
        // pour qu'aucune sauvegarde de l'ancien travail n'arrive après le remplacement.
        async handleRestart () {
            this.setState({confirmer: false, busy: true, message: 'On repart du projet de départ…'});
            this.saver.stop();
            try {
                if (this.saver.inFlight) await this.saver.inFlight.catch(() => {});
                this.saver.markClean();
                const data = await restartProject(this.lesson);
                const projet = await fetchProject(this.lesson);
                if (projet) await this.props.vm.loadProject(projet.buffer);
                this.saver.markClean();
                this.setState({busy: false, message: data.message, termine: false});
            } catch (error) {
                this.setState({busy: false, message: error.message});
            } finally {
                this.saver.start();
            }
        }

        render () {
            const {
                /* eslint-disable no-unused-vars */
                vm,
                ready,
                /* eslint-enable no-unused-vars */
                ...componentProps
            } = this.props;
            return (
                <React.Fragment>
                    <WrappedComponent {...componentProps} />
                    {this.mystery && this.state.message && (
                        <div
                            role="status"
                            style={NOTICE_STYLE(false)}
                        >{this.state.message}</div>
                    )}
                    {this.lesson && this.state.message && (
                        <div
                            role="status"
                            style={NOTICE_STYLE(this.vert())}
                        >
                            <div>{this.state.message}</div>
                            {this.state.comportement && (
                                <div style={{marginTop: 6}}>{this.state.comportement}</div>
                            )}
                            {this.state.termine && (
                                <button
                                    style={this.vert() ? BUTTON_SUITE : BUTTON_SUITE_NEUTRE}
                                    onClick={this.handleSuite}
                                >
                                    {this.challenge ? 'Voir ma preuve' : 'Continuer la leçon'}
                                </button>
                            )}
                        </div>
                    )}
                    {this.challenge && this.state.confirmer && (
                        <div
                            role="alertdialog"
                            aria-label="Repartir du projet de départ"
                            style={NOTICE_STYLE(false)}
                        >
                            <strong>{'Repartir du projet de départ ?'}</strong>
                            <p style={{margin: '4px 0 8px'}}>
                                {'Le travail enregistré pour ce défi sera remplacé par le projet de départ. ' +
                                 'Tes défis réussis et tes preuves ne changent pas.'}
                            </p>
                            <button
                                style={{...BUTTON_SUITE, marginTop: 0, marginRight: 6}}
                                onClick={this.handleRestart}
                            >
                                {'Oui, remplacer mon travail'}
                            </button>
                            <button
                                style={{...BUTTON_STYLE, borderColor: '#d9d9d9'}}
                                onClick={this.handleRestartCancel}
                            >
                                {'Annuler'}
                            </button>
                        </div>
                    )}
                    {this.lesson && this.state.consignes && this.state.panneau && (
                        <div
                            aria-label="Consignes"
                            id="academycode-consignes"
                            role="region"
                            style={this.stylePanneau()}
                            onKeyDown={this.handleClavier}
                        >
                            <div
                                aria-label="Déplacer les consignes (souris, doigt ou flèches du clavier)"
                                data-panneau-bandeau
                                role="button"
                                style={this.state.bandeauFocus ? BANDEAU_FOCUS_STYLE : BANDEAU_STYLE}
                                tabIndex={0}
                                title="Glisse ce bandeau pour déplacer les consignes"
                                onBlur={this.handleBandeauBlur}
                                onFocus={this.handleBandeauFocus}
                                onLostPointerCapture={this.handleLacher}
                                onPointerDown={this.handleSaisie}
                                onPointerMove={this.handleDeplacement}
                                onPointerUp={this.handleLacher}
                            >
                                <span aria-hidden="true">{'⠿'}</span>
                                <span>{'Consignes'}</span>
                                <button
                                    aria-label="Fermer les consignes"
                                    style={FERMER_STYLE}
                                    onClick={this.handleFermer}
                                >{'×'}</button>
                            </div>
                            <div style={CORPS_STYLE}>
                                <strong>{this.state.consignes.titre}</strong>
                                {this.state.consignes.objectif && (
                                    <p style={{margin: '4px 0 8px'}}>{this.state.consignes.objectif}</p>
                                )}
                                <ol style={{margin: 0, paddingLeft: 18}}>
                                    {this.state.consignes.etapes.map((etape, i) => (
                                        <li
                                            key={i}
                                            style={{marginBottom: 4}}
                                        >{etape}</li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    )}
                    {this.lesson && (
                        <div
                            role="status"
                            style={BAR_STYLE}
                        >
                            <button
                                disabled={this.state.busy}
                                style={BUTTON_STYLE}
                                onClick={this.handleVerify}
                            >
                                {'Vérifier mon projet'}
                            </button>
                            {this.pleinEcran && (
                                <button
                                    style={BUTTON_SECONDAIRE}
                                    onClick={this.handleFullscreen}
                                >
                                    {this.state.fullscreen ? this.retour : 'Plein écran'}
                                </button>
                            )}
                            {this.challenge && (
                                <button
                                    disabled={this.state.busy}
                                    style={BUTTON_SECONDAIRE}
                                    onClick={this.handleRestartAsk}
                                >
                                    {'Repartir du départ'}
                                </button>
                            )}
                            {this.state.consignes && (
                                <button
                                    aria-controls="academycode-consignes"
                                    aria-expanded={this.state.panneau}
                                    ref={this.boutonConsignes}
                                    style={BUTTON_SECONDAIRE}
                                    onClick={this.handlePanneau}
                                >
                                    {this.state.panneau ? 'Cacher les consignes' : 'Voir les consignes'}
                                </button>
                            )}

                        </div>
                    )}
                </React.Fragment>
            );
        }
    }

    Bridge.propTypes = {
        ready: PropTypes.bool,
        vm: PropTypes.instanceOf(VM).isRequired
    };

    const mapStateToProps = state => ({
        vm: state.scratchGui.vm,
        ready: getIsShowingProject(state.scratchGui.projectState.loadingState)
    });

    return connect(mapStateToProps, () => ({}))(Bridge);
};

export default BridgeHOC;
