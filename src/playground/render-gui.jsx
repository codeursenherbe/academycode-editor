import React from 'react';
import ReactDOM from 'react-dom';
import {compose} from 'redux';

import AppStateHOC from '../lib/app-state-hoc.jsx';
import GUI from '../containers/gui.jsx';
import HashParserHOC from '../lib/hash-parser-hoc.jsx';
import BridgeHOC from '../lib/academycode/bridge-hoc.jsx';
import {mysteryId} from '../lib/academycode/api.js';

/*
 * Éditeur AcademyCode : pas de logo cliquable, de sac à dos, de télémétrie ni de confirmation de
 * fermeture. Le projet est sauvegardé par le pont (src/lib/academycode/).
 * {object} appTarget - the DOM element to render to
 */
export default appTarget => {
    GUI.setAppElement(appTarget);

    const WrappedGui = compose(
        AppStateHOC,
        HashParserHOC,
        BridgeHOC
    )(GUI);

    // Lecteur d'un programme mystère : la scène seule (mode « player » de scratch-gui),
    // sans scripts ni titre modifiable.
    const lecteur = mysteryId() !== null;
    ReactDOM.render(
        <WrappedGui
            canEditTitle={!lecteur}
            isPlayerOnly={lecteur}
        />,
        appTarget
    );
};
