import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {getIsShowingProject} from '../../reducers/project-state';
import AutoSaver from './autosave.js';
import {lessonId, fetchProject, putProject, fetchConsignes, NETWORK_MESSAGE} from './api.js';

const PERIOD_MS = 30000;

const BAR_STYLE = {
    position: 'fixed',
    right: 8,
    bottom: 8,
    zIndex: 1000,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    maxWidth: '60%',
    padding: '6px 10px',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 8,
    font: '14px sans-serif',
    color: '#575e75'
};
// Le message de vérification : vert quand la leçon est validée, neutre sinon.
const NOTICE_STYLE = reussi => ({
    position: 'fixed',
    right: 8,
    bottom: 52,
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

const PANEL_STYLE = {
    position: 'fixed',
    right: 8,
    bottom: 52,
    zIndex: 1000,
    maxWidth: 320,
    maxHeight: '60vh',
    overflowY: 'auto',
    padding: '10px 12px',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 8,
    font: 'inherit',
    fontSize: 14,
    lineHeight: 1.4,
    color: '#222'
};

const BUTTON_STYLE = {
    background: '#4c97ff',
    color: '#fff',
    border: 0,
    borderRadius: 6,
    padding: '6px 12px',
    font: 'inherit',
    cursor: 'pointer'
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
            this.lesson = lessonId();
            this.started = false;
            this.state = {message: '', busy: false, fullscreen: false, consignes: null, panneau: true, termine: false};
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
        }

        componentDidUpdate () {
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
                const buffer = await fetchProject(this.lesson);
                if (buffer) {
                    await this.props.vm.loadProject(buffer);
                    this.setState({message: 'Ton projet a été rechargé.'});
                }
            } catch (error) {
                this.setState({message: error.message});
            }
            fetchConsignes(this.lesson).then(consignes => this.setState({consignes})).catch(() => {});
            this.saver.markClean();
            this.props.vm.on('PROJECT_CHANGED', this.handleChanged);
            document.addEventListener('fullscreenchange', this.handleFullscreenChange);
            document.addEventListener('visibilitychange', this.handleHidden);
            window.addEventListener('pagehide', this.handleHidden);
            this.saver.start();
        }

        async save () {
            const blob = await this.props.vm.saveProjectSb3();
            const data = await putProject(this.lesson, blob);
            this.setState({message: 'Projet sauvegardé.'});
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
            this.setState({busy: true, message: 'Vérification en cours…'});
            try {
                const data = await this.saver.flush(true);
                this.setState({busy: false, message: data.message, termine: Boolean(data.completed)});
            } catch (error) {
                this.setState({busy: false, message: error.message});
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
                    {this.lesson && this.state.message && (
                        <div
                            role="status"
                            style={NOTICE_STYLE(this.state.termine)}
                        >
                            <div>{this.state.message}</div>
                            {this.state.termine && (
                                <button
                                    style={{...BUTTON_STYLE, marginTop: 8, background: '#3aa76d'}}
                                    onClick={this.handleSuite}
                                >
                                    {'Continuer la leçon'}
                                </button>
                            )}
                        </div>
                    )}
                    {this.lesson && this.state.consignes && this.state.panneau && (
                        <div style={{...PANEL_STYLE, bottom: this.state.message ? 140 : 52}}>
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
                                style={BUTTON_STYLE}
                                onClick={this.handleFullscreen}
                            >
                                {this.state.fullscreen ? 'Retour à la leçon' : 'Plein écran'}
                            </button>
                            {this.state.consignes && (
                                <button
                                    style={BUTTON_STYLE}
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
