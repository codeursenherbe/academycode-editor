import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import VM from 'scratch-vm';

import backdropLibraryContent from '../lib/libraries/backdrops.json';
import backdropTags from '../lib/libraries/backdrop-tags';
import LibraryComponent from '../components/library/library.jsx';
import {avecBibliothequeAcademyCode} from '../lib/academycode/bibliotheque-academycode.jsx';

const messages = defineMessages({
    libraryTitle: {
        defaultMessage: 'Choose a Backdrop',
        description: 'Heading for the backdrop library',
        id: 'gui.costumeLibrary.chooseABackdrop'
    }
});


class BackdropLibrary extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect'
        ]);
    }
    handleItemSelect (item) {
        const vmBackdrop = {
            name: item.name,
            rotationCenterX: item.rotationCenterX,
            rotationCenterY: item.rotationCenterY,
            bitmapResolution: item.bitmapResolution,
            skinId: null
        };
        // Do not switch to stage, just add the backdrop
        this.props.vm.addBackdrop(item.md5ext, vmBackdrop);
    }
    render () {
        return (
            <LibraryComponent
                data={this.props.data}
                id="backdropLibrary"
                tags={this.props.tags}
                title={this.props.intl.formatMessage(messages.libraryTitle)}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

BackdropLibrary.propTypes = {
    data: PropTypes.arrayOf(PropTypes.object).isRequired,
    tags: PropTypes.arrayOf(PropTypes.object).isRequired,
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

// Bibliothèque enrichie d'AcademyCode (lot L8) : éléments d'origine en tête, catalogue chargé à l'ouverture.
export default avecBibliothequeAcademyCode('backdrops', backdropLibraryContent, backdropTags)(
    injectIntl(BackdropLibrary)
);
