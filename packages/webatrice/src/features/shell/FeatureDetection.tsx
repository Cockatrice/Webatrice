import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { usePushToast } from '@app/components';
import { dexieService } from '@app/services';
import { RouteEnum } from '@app/types';
import { getBrowserSupport } from '@app/utils';

const FeatureDetection = () => {
  const { t } = useTranslation();
  const pushToast = usePushToast();
  const [unsupported, setUnsupported] = useState(false);
  const noticeShown = useRef(false);

  useEffect(() => {
    dexieService.testConnection().catch(() => setUnsupported(true));
  }, []);

  useEffect(() => {
    if (noticeShown.current) {
      return;
    }
    noticeShown.current = true;

    const { missingOptional } = getBrowserSupport();
    if (missingOptional.length > 0) {
      const features = missingOptional.map((feature) => t(`BrowserFeature.${feature}`)).join('; ');
      pushToast(t('FeatureDetection.degraded', { features }), { severity: 'warning' });
    }
  }, [t, pushToast]);

  return unsupported
    ? <Navigate to={RouteEnum.UNSUPPORTED} />
    : <></>;
};

export default FeatureDetection;
