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
    overflowY: 'auto',
    boxShadow: '0 2px 8px rgba(0,0,0,.15)',
    padding: '10px 12px',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 8,
    font: 'inherit',
    fontSize: 14,
    lineHeight: 1.4,
    color: '#222'
};

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
            this.started = false;
            this.state = {
                message: '',
                comportement: '',
                busy: false,
                fullscreen: false,
                consignes: null,
                panneau: !this.challenge,
                termine: false,
                confirmer: false,
                conforme: null
            };
            this.saver = new AutoSaver({
                save: () => this.save(),
                periodMs: PERIOD_MS,
                onError: () => this.setState({message: NETWORK_MESSAGE})
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
            document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
            document.removeEventListener('visibilitychange', this.handleHidden);
            window.removeEventListener('pagehide', this.handleHidden);
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
            document.addEventListener('fullscreenchange', this.handleFullscreenChange);
            document.addEventListener('visibilitychange', this.handleHidden);
            window.addEventListener('pagehide', this.handleHidden);
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
        handleFullscreen () {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
        }

        // Ramène l'enfant à la page de la leçon (quiz, bouton « Leçon terminée »),
        // qui est sous l'iframe : on sort du plein écran et la page fait défiler.
        handleSuite () {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            window.parent.postMessage({academycode: 'lecon-terminee'}, window.location.origin);
        }

        handlePanneau () {
            this.setState(state => ({panneau: !state.panneau}));
        }

        // Le navigateur quitte le plein écran de lui-même dès qu'il ouvre une fenêtre système
        // (import d'une image, par exemple) : on le dit à l'enfant plutôt que de le laisser deviner.
        handleFullscreenChange () {
            const fullscreen = Boolean(document.fullscreenElement);
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
                        <div style={PANEL_STYLE}>
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
                            <button
                                style={BUTTON_SECONDAIRE}
                                onClick={this.handleFullscreen}
                            >
                                {this.state.fullscreen ? this.retour : 'Plein écran'}
                            </button>
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
