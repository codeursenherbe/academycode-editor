import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {getIsShowingProject} from '../../reducers/project-state';
import AutoSaver from './autosave.js';
import {lessonId, fetchProject, putProject, NETWORK_MESSAGE} from './api.js';

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
            this.state = {message: '', busy: false};
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
        }

        componentDidUpdate () {
            if (this.lesson && !this.started && this.props.ready) {
                this.started = true;
                this.begin();
            }
        }

        componentWillUnmount () {
            this.saver.stop();
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
            this.saver.markClean();
            this.props.vm.on('PROJECT_CHANGED', this.handleChanged);
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

        async handleVerify () {
            this.setState({busy: true, message: 'Vérification en cours…'});
            try {
                const data = await this.saver.flush(true);
                this.setState({busy: false, message: data.message});
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
                            <span>{this.state.message}</span>
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
