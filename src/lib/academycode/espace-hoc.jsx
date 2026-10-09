import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {getIsShowingProject} from '../../reducers/project-state';
import {setFullScreen} from '../../reducers/mode';
import AutoSaver from './autosave.js';
import {NETWORK_MESSAGE} from './api.js';
import {
    espaceContext, fetchEspaceProject, putEspaceProject, restartEspace, fetchEspaceConsignes
} from './espace-api.js';

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
// Présentation : la scène est claire, le bouton est donc foncé (le style blanc des barres serait invisible).
const PRESENTATION_BUTTON_STYLE = {
    background: 'rgba(15, 23, 42, .78)',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '8px 16px',
    font: 'inherit',
    cursor: 'pointer'
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

// Panneau « Consignes » : à droite de la zone de code par défaut (les scripts sont à gauche), déplaçable par son
// bandeau.
const PANEL_STYLE = {
    position: 'fixed',
    zIndex: 1000,
    width: 330,
    maxHeight: 'calc(100vh - 130px)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 14px rgba(0,0,0,.22)',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 8,
    font: '14px sans-serif',
    lineHeight: 1.45,
    color: '#222'
};
const PANEL_HEAD_STYLE = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    background: '#8b5cf6',
    color: '#fff',
    borderRadius: '7px 7px 0 0',
    cursor: 'move',
    touchAction: 'none',
    userSelect: 'none',
    fontWeight: 700
};
const PANEL_CLOSE_STYLE = {
    border: 0,
    background: 'transparent',
    color: '#fff',
    font: 'inherit',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1
};
const PANEL_BODY_STYLE = {overflowY: 'auto', padding: '10px 12px'};
const PANEL_TITLE_STYLE = {margin: '10px 0 4px', fontWeight: 700, color: '#475569'};
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
            this.state = {
                message: '', confirmer: false, busy: false, fullscreen: false,
                consignes: null, panneau: false, place: null
            };
            this.panelRef = React.createRef();
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
            this.handlePanneau = () => this.setState(state => ({panneau: !state.panneau}));
            this.handleDragStart = this.handleDragStart.bind(this);
            this.handleDragMove = this.handleDragMove.bind(this);
            this.handleDragEnd = this.handleDragEnd.bind(this);
            this.handleRestartAsk = () => this.setState({confirmer: true});
            this.handleRestartCancel = () => this.setState({confirmer: false});
            this.handleFullscreen = this.handleFullscreen.bind(this);
            this.handleFullscreenChange = () => this.setState({fullscreen: Boolean(document.fullscreenElement)});
        }

        componentDidUpdate () {
            if (!this.started && this.props.ready) {
                this.started = true;
                // Présentation (vidéoprojection) : la scène occupe tout le cadre dès l'ouverture ; le bouton de la
                // scène permet de revenir à la petite taille.
                if (contexte.mode === 'presentation') this.props.onFullScreen();
                this.begin();
            }
        }

        componentWillUnmount () {
            this.saver.stop();
            this.handleDragEnd();
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
                    this.redraw();
                    if (contexte.mode === 'copie' && !projet.depart) {
                        this.setState({message: 'Ta version a été rechargée.'});
                    }
                }
            } catch (error) {
                this.setState({message: error.message});
            }
            if (contexte.mode !== 'presentation') {
                fetchEspaceConsignes(contexte.path).then(consignes => this.setState({consignes}));
            }
            // Plein écran (bouton de l'éditeur) : suivi dans les trois modes, pour que le libellé devienne « Quitter… ».
            document.addEventListener('fullscreenchange', this.handleFullscreenChange);
            if (contexte.mode !== 'copie') return;
            this.saver.markClean();
            this.props.vm.on('PROJECT_CHANGED', this.handleChanged);
            window.addEventListener('message', this.handleMessage);
            document.addEventListener('visibilitychange', this.handleHidden);
            window.addEventListener('pagehide', this.handleHidden);
            this.saver.start();
        }

        // Sans dessin explicite, la scène garde l'image du projet par défaut (le chat de Scratch) jusqu'au premier
        // drapeau vert : la VM n'est pas en boucle en présentation. Deuxième dessin après le passage en plein cadre.
        redraw () {
            const {vm} = this.props;
            vm.runtime.requestRedraw();
            if (!vm.renderer) return;
            vm.renderer.draw();
            setTimeout(() => vm.renderer.draw(), 400);
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
                this.redraw();
                this.saver.markClean();
                this.setState({busy: false, message: data.message});
            } catch (error) {
                this.setState({busy: false, message: error.message});
            } finally {
                this.saver.start();
            }
        }

        // Panneau déplaçable : on part de sa position affichée, puis on suit le pointeur en restant dans la fenêtre.
        handleDragStart (event) {
            if (!this.panelRef.current || event.target.tagName === 'BUTTON') return;
            const rect = this.panelRef.current.getBoundingClientRect();
            this.drag = {dx: event.clientX - rect.left, dy: event.clientY - rect.top};
            this.setState({place: {x: rect.left, y: rect.top}});
            window.addEventListener('pointermove', this.handleDragMove);
            window.addEventListener('pointerup', this.handleDragEnd);
            event.preventDefault();
        }

        handleDragMove (event) {
            if (!this.drag) return;
            const x = Math.min(Math.max(0, event.clientX - this.drag.dx), window.innerWidth - 120);
            const y = Math.min(Math.max(0, event.clientY - this.drag.dy), window.innerHeight - 40);
            this.setState({place: {x, y}});
        }

        handleDragEnd () {
            this.drag = null;
            window.removeEventListener('pointermove', this.handleDragMove);
            window.removeEventListener('pointerup', this.handleDragEnd);
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
                onFullScreen,
                /* eslint-enable no-unused-vars */
                ...componentProps
            } = this.props;
            const {message, confirmer, busy, fullscreen, consignes, panneau, place} = this.state;
            const boutonConsignes = consignes && (
                <button
                    style={BUTTON_STYLE}
                    onClick={this.handlePanneau}
                >{panneau ? 'Cacher les consignes' : 'Consignes'}</button>
            );
            // Même bouton dans les trois modes (référence, ma version, présentation) : il devient « Quitter le plein écran ».
            const boutonPleinEcran = style => (
                <button
                    style={style}
                    onClick={this.handleFullscreen}
                >{fullscreen ? 'Quitter le plein écran' : 'Plein écran'}</button>
            );
            const positionPanneau = place ? {left: place.x, top: place.y} : {right: 540, top: 92};
            return (
                <React.Fragment>
                    <WrappedComponent {...componentProps} />
                    {contexte.mode === 'lecture' && (
                        <div
                            role="status"
                            style={BAR_STYLE}
                        >
                            <span style={BADGE_STYLE}>{'Référence officielle · lecture seule'}</span>
                            {boutonConsignes}
                            {boutonPleinEcran(BUTTON_STYLE)}
                        </div>
                    )}
                    {contexte.mode === 'copie' && (
                        <div
                            role="status"
                            style={BAR_STYLE}
                        >
                            <span style={BADGE_STYLE}>{message || 'Ta version'}</span>
                            {boutonConsignes}
                            <button
                                disabled={busy}
                                style={BUTTON_STYLE}
                                onClick={this.handleRestartAsk}
                            >{'Repartir de la référence'}</button>
                            {boutonPleinEcran(BUTTON_STYLE)}
                        </div>
                    )}
                    {contexte.mode === 'presentation' && (
                        <div style={{...BAR_STYLE, top: 'auto', bottom: 8}}>
                            {boutonPleinEcran(PRESENTATION_BUTTON_STYLE)}
                        </div>
                    )}
                    {contexte.mode === 'presentation' && message && (
                        <div
                            role="status"
                            style={CONFIRM_STYLE}
                        >{message}</div>
                    )}
                    {contexte.mode !== 'presentation' && consignes && panneau && (
                        <div
                            ref={this.panelRef}
                            role="region"
                            aria-label="Consignes de l’étape"
                            style={{...PANEL_STYLE, ...positionPanneau}}
                        >
                            <div
                                style={PANEL_HEAD_STYLE}
                                onPointerDown={this.handleDragStart}
                            >
                                <span>{consignes.titre}</span>
                                <button
                                    aria-label="Fermer les consignes"
                                    style={PANEL_CLOSE_STYLE}
                                    onClick={this.handlePanneau}
                                >{'×'}</button>
                            </div>
                            <div style={PANEL_BODY_STYLE}>
                                {consignes.objectif && (
                                    <p style={{margin: '0 0 6px'}}>
                                        <strong>{'Objectif : '}</strong>{consignes.objectif}
                                    </p>
                                )}
                                <div style={PANEL_TITLE_STYLE}>{'À faire'}</div>
                                <ol style={{margin: 0, paddingLeft: 20}}>
                                    {consignes.etapes.map((etape, i) => (
                                        <li
                                            key={i}
                                            style={{marginBottom: 5}}
                                        >{etape}</li>
                                    ))}
                                </ol>
                                {consignes.criteres.length > 0 && (
                                    <React.Fragment>
                                        <div style={PANEL_TITLE_STYLE}>{'Étape terminée quand'}</div>
                                        <ul style={{margin: 0, paddingLeft: 20}}>
                                            {consignes.criteres.map((critere, i) => (
                                                <li
                                                    key={i}
                                                    style={{marginBottom: 4}}
                                                >{critere}</li>
                                            ))}
                                        </ul>
                                    </React.Fragment>
                                )}
                            </div>
                        </div>
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
        onFullScreen: PropTypes.func,
        ready: PropTypes.bool,
        vm: PropTypes.instanceOf(VM).isRequired
    };

    const mapStateToProps = state => ({
        vm: state.scratchGui.vm,
        ready: getIsShowingProject(state.scratchGui.projectState.loadingState)
    });

    const mapDispatchToProps = dispatch => ({
        onFullScreen: () => dispatch(setFullScreen(true))
    });

    return connect(mapStateToProps, mapDispatchToProps)(Espace);
};

export default EspaceHOC;
