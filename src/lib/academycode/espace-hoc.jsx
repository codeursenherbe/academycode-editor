import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {getIsShowingProject} from '../../reducers/project-state';
import AutoSaver from './autosave.js';
import {NETWORK_MESSAGE} from './api.js';
import {espaceContext, fetchEspaceProject, putEspaceProject, restartEspace} from './espace-api.js';

const PERIOD_MS = 30000;

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
const BADGE_STYLE = {
    padding: '6px 12px',
    borderRadius: 999,
    background: '#fff',
    color: '#334155',
    border: '1px solid #cbd5e1'
};
const BUTTON_STYLE = {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.6)',
    borderRadius: 999,
    padding: '6px 14px',
    font: 'inherit',
    cursor: 'pointer'
};
const CONFIRM_STYLE = {
    position: 'fixed',
    right: 8,
    top: 100,
    zIndex: 1001,
    maxWidth: 320,
    padding: '10px 12px',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 8,
    font: '14px sans-serif',
    lineHeight: 1.4,
    color: '#333'
};

const CONFIRM_YES_STYLE = {
    ...BUTTON_STYLE, color: '#fff', background: '#3aa76d', borderColor: '#3aa76d', marginRight: 6
};
const CONFIRM_NO_STYLE = {...BUTTON_STYLE, color: '#333', borderColor: '#d9d9d9'};

/**
 * Relie l'éditeur à l'Espace Animateur (voir espace-api.js). Sans contexte valide dans l'URL, ce HOC n'enveloppe
 * RIEN : l'éditeur (et le pont AcademyCode) se comportent exactement comme avant.
 * - lecture : charge la référence, aucune sauvegarde, aucun envoi, jamais ;
 * - copie : charge la copie (ou la référence à défaut), sauvegarde toutes les 30 s si modifié, « Repartir de la
 *   référence », et enregistre sur demande de la page (postMessage « enregistrer » -> « enregistre ») ;
 * - presentation : charge la copie (ou la référence), lecteur seul.
 * @param {React.Component} WrappedComponent - l'éditeur à envelopper
 * @returns {React.Component} l'éditeur relié à l'Espace Animateur
 */
const EspaceHOC = function (WrappedComponent) {
    const contexte = espaceContext();
    if (!contexte) return WrappedComponent;

    class Espace extends React.Component {
        constructor (props) {
            super(props);
            this.started = false;
            this.state = {message: '', confirmer: false, busy: false, fullscreen: false};
            this.saver = new AutoSaver({
                save: () => this.save(),
                periodMs: PERIOD_MS,
                onError: error => this.setState({message: error.message || NETWORK_MESSAGE})
            });
            this.handleChanged = () => this.saver.markDirty();
            this.handleHidden = () => {
                // Au mieux : le navigateur ne garantit pas une requête émise pendant la fermeture.
                if (document.visibilityState === 'hidden') this.saver.tick();
            };
            this.handleMessage = this.handleMessage.bind(this);
            this.handleRestart = this.handleRestart.bind(this);
            this.handleRestartAsk = () => this.setState({confirmer: true});
            this.handleRestartCancel = () => this.setState({confirmer: false});
            this.handleFullscreen = this.handleFullscreen.bind(this);
            this.handleFullscreenChange = () => this.setState({fullscreen: Boolean(document.fullscreenElement)});
        }

        componentDidUpdate () {
            if (!this.started && this.props.ready) {
                this.started = true;
                this.begin();
            }
        }

        componentWillUnmount () {
            this.saver.stop();
            window.removeEventListener('message', this.handleMessage);
            document.removeEventListener('visibilitychange', this.handleHidden);
            document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
            window.removeEventListener('pagehide', this.handleHidden);
            if (this.props.vm) this.props.vm.off('PROJECT_CHANGED', this.handleChanged);
        }

        async begin () {
            try {
                const projet = await fetchEspaceProject(contexte.path);
                if (projet) {
                    await this.props.vm.loadProject(projet.buffer);
                    if (contexte.mode === 'copie' && !projet.depart) {
                        this.setState({message: 'Ta version a été rechargée.'});
                    }
                }
            } catch (error) {
                this.setState({message: error.message});
            }
            if (contexte.mode !== 'copie') return;
            this.saver.markClean();
            this.props.vm.on('PROJECT_CHANGED', this.handleChanged);
            window.addEventListener('message', this.handleMessage);
            document.addEventListener('visibilitychange', this.handleHidden);
            document.addEventListener('fullscreenchange', this.handleFullscreenChange);
            window.addEventListener('pagehide', this.handleHidden);
            this.saver.start();
        }

        async save () {
            const blob = await this.props.vm.saveProjectSb3();
            const data = await putEspaceProject(contexte.path, blob);
            this.setState({message: 'Ta version est enregistrée.', busy: false});
            return data;
        }

        // La page demande d'enregistrer avant de changer d'étape ou d'usage : on répond dans tous les cas.
        async handleMessage (event) {
            const {origin, data: contenu} = event;
            const demande = origin === window.location.origin && contenu && contenu.academycode === 'enregistrer';
            if (!demande) return;
            try {
                await this.saver.flush();
            } catch (error) {
                this.setState({message: error.message || NETWORK_MESSAGE});
            }
            window.parent.postMessage({academycode: 'enregistre'}, window.location.origin);
        }

        // Repartir de la référence : on arrête l'auto-sauvegarde et on attend celle en vol, pour qu'aucune ancienne
        // sauvegarde n'arrive après le remplacement (même précaution que le pont AcademyCode).
        async handleRestart () {
            this.setState({confirmer: false, busy: true, message: 'On repart de la référence…'});
            this.saver.stop();
            try {
                if (this.saver.inFlight) await this.saver.inFlight.catch(() => {});
                this.saver.markClean();
                const data = await restartEspace(contexte.path);
                const projet = await fetchEspaceProject(contexte.path);
                if (projet) await this.props.vm.loadProject(projet.buffer);
                this.saver.markClean();
                this.setState({busy: false, message: data.message});
            } catch (error) {
                this.setState({busy: false, message: error.message});
            } finally {
                this.saver.start();
            }
        }

        handleFullscreen () {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
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
            const {message, confirmer, busy, fullscreen} = this.state;
            return (
                <React.Fragment>
                    <WrappedComponent {...componentProps} />
                    {contexte.mode === 'lecture' && (
                        <div
                            role="status"
                            style={BAR_STYLE}
                        >
                            <span style={BADGE_STYLE}>{'Référence officielle · lecture seule'}</span>
                        </div>
                    )}
                    {contexte.mode === 'copie' && (
                        <div
                            role="status"
                            style={BAR_STYLE}
                        >
                            <span style={BADGE_STYLE}>{message || 'Ta version'}</span>
                            <button
                                disabled={busy}
                                style={BUTTON_STYLE}
                                onClick={this.handleRestartAsk}
                            >{'Repartir de la référence'}</button>
                            <button
                                style={BUTTON_STYLE}
                                onClick={this.handleFullscreen}
                            >{fullscreen ? 'Quitter le plein écran' : 'Plein écran'}</button>
                        </div>
                    )}
                    {contexte.mode === 'presentation' && message && (
                        <div
                            role="status"
                            style={CONFIRM_STYLE}
                        >{message}</div>
                    )}
                    {confirmer && (
                        <div
                            role="alertdialog"
                            aria-label="Repartir de la référence"
                            style={CONFIRM_STYLE}
                        >
                            <strong>{'Repartir de la référence ?'}</strong>
                            <p style={{margin: '4px 0 8px'}}>
                                {'Ta version de cette étape sera remplacée par la référence officielle.'}
                            </p>
                            <button
                                style={CONFIRM_YES_STYLE}
                                onClick={this.handleRestart}
                            >{'Oui, remplacer ma version'}</button>
                            <button
                                style={CONFIRM_NO_STYLE}
                                onClick={this.handleRestartCancel}
                            >{'Annuler'}</button>
                        </div>
                    )}
                </React.Fragment>
            );
        }
    }

    Espace.propTypes = {
        ready: PropTypes.bool,
        vm: PropTypes.instanceOf(VM).isRequired
    };

    const mapStateToProps = state => ({
        vm: state.scratchGui.vm,
        ready: getIsShowingProject(state.scratchGui.projectState.loadingState)
    });

    return connect(mapStateToProps, () => ({}))(Espace);
};

export default EspaceHOC;
