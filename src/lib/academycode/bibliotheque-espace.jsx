// Bibliothèque « Codeurs en Herbe » (mode Espace Animateur uniquement) : dessins originaux de l'Espace, servis à côté
// de l'éditeur (/editeur/static/bibliotheque-ceh.json, images dans /editeur/static/lib-assets/). Ils s'ajoutent
// EN TÊTE des bibliothèques (lutins, arrière-plans, costumes), avec leurs catégories. Hors Espace (AcademyCode), rien :
// aucune requête, aucune catégorie en plus.
import React from 'react';
import {espaceContext} from './espace-api.js';

export const URL_BIBLIOTHEQUE = '/editeur/static/bibliotheque-ceh.json';

let promesse = null;

/**
 * @param {string} search - la partie « ?… » de l'URL
 * @returns {Promise<?object>} {sprites, backdrops, costumes, themes}, ou null hors Espace ou en cas d'échec
 */
export const chargerBibliothequeEspace = (search = window.location.search) => {
    if (!espaceContext(search)) return Promise.resolve(null);
    if (!promesse) {
        promesse = fetch(URL_BIBLIOTHEQUE, {credentials: 'same-origin'})
            .then(reponse => (reponse.ok ? reponse.json() : null))
            .catch(() => null)
            .then(bib => (bib && Array.isArray(bib.sprites) ? bib : null));
    }
    return promesse;
};

/** Pour les tests : oublie la bibliothèque déjà chargée. */
export const oublierBibliothequeEspace = () => {
    promesse = null;
};

/**
 * @param {?object} bib - bibliothèque chargée
 * @returns {Array} ses catégories, au format des boutons de catégorie de scratch-gui
 */
export const etiquettesEspace = bib => (bib?.themes ?? []).map(({tag, label}) => ({
    tag,
    intlLabel: {id: `gui.espace.bibliotheque.${tag}`, defaultMessage: label, description: 'Catégorie Codeurs en Herbe'}
}));

/**
 * Enveloppe un conteneur de bibliothèque : `data` et `tags` reçoivent en tête les dessins Codeurs en Herbe de la clé
 * donnée (sprites, backdrops, costumes) dès qu'ils sont chargés.
 * @param {string} cle - clé du JSON
 * @param {Array} contenu - bibliothèque d'origine
 * @param {Array} tags - catégories d'origine
 * @returns {function} HOC
 */
export const avecBibliothequeEspace = (cle, contenu, tags) => Enveloppe => {
    class AvecBibliotheque extends React.Component {
        constructor (props) {
            super(props);
            this.state = {bib: null};
        }
        componentDidMount () {
            this.vivant = true;
            chargerBibliothequeEspace().then(bib => {
                if (this.vivant && bib) this.setState({bib});
            });
        }
        componentWillUnmount () {
            this.vivant = false;
        }
        render () {
            const {bib} = this.state;
            return (
                <Enveloppe
                    {...this.props}
                    data={bib ? [...(bib[cle] ?? []), ...contenu] : contenu}
                    tags={bib ? [...etiquettesEspace(bib), ...tags] : tags}
                />
            );
        }
    }
    return AvecBibliotheque;
};
