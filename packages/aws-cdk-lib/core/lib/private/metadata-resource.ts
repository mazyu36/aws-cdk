import * as zlib from 'zlib';
import { Construct } from 'constructs';
import { ConstructInfo, constructInfoFromStack } from './runtime-info';
import * as cxapi from '../../../cx-api';
import { RegionInfo } from '../../../region-info';
import { CfnCondition } from '../cfn-condition';
import { Fn } from '../cfn-fn';
import { Aws } from '../cfn-pseudo';
import { CfnResource } from '../cfn-resource';
import { AssumptionError } from '../errors';
import { FeatureFlags } from '../feature-flags';
import { Lazy } from '../lazy';
import { Stack } from '../stack';
import { Token } from '../token';

/**
 * Construct that will render the metadata resource
 */
export class MetadataResource extends Construct {
  constructor(scope: Stack, id: string) {
    super(scope, id);
    const metadataServiceExists = Token.isUnresolved(scope.region) || RegionInfo.get(scope.region).cdkMetadataResourceAvailable;
    const enableAdditionalTelemtry = FeatureFlags.of(scope).isEnabled(cxapi.ENABLE_ADDITIONAL_METADATA_COLLECTION) ?? false;
    if (metadataServiceExists) {
      const constructInfo = constructInfoFromStack(scope);
      const resource = new CfnResource(this, 'Default', {
        type: 'AWS::CDK::Metadata',
        properties: {
          Analytics: Lazy.string({ produce: () => formatAnalytics(constructInfo, enableAdditionalTelemtry) }),
        },
      });

      // In case we don't actually know the region, add a condition to determine it at deploy time
      if (Token.isUnresolved(scope.region)) {
        const condition = new CfnCondition(this, 'Condition', {
          expression: makeCdkMetadataAvailableCondition(),
        });

        // To not cause undue template changes
        condition.overrideLogicalId('CDKMetadataAvailable');

        resource.cfnOptions.condition = condition;
      }
    }
  }
}

function makeCdkMetadataAvailableCondition() {
  return Fn.conditionOr(...RegionInfo.regions
    .filter(ri => ri.cdkMetadataResourceAvailable)
    .map(ri => Fn.conditionEquals(Aws.REGION, ri.name)));
}

/** Convenience type for arbitrarily-nested map */
class Trie extends Map<string, Trie> { }

/**
 * Formats the analytics string which has 3 or 4 sections separated by colons (:)
 *
 * version:encoding:constructinfo OR version:encoding:constructinfo:appinfo
 *
 * The constructinfo section is a list of construct fully-qualified names (FQNs)
 * and versions into a (possibly compressed) prefix-encoded string.
 *
 * The list of ConstructInfos is logically formatted into: ${version}!${fqn}
 * (e.g., "1.90.0!aws-cdk-lib.Stack") and then all of the construct-versions are
 * grouped with common prefixes together, grouping common parts in '{}' and
 * separating items with ','.
 *
 * Example:
 * [1.90.0!aws-cdk-lib.Stack, 1.90.0!aws-cdk-lib.Construct, 1.90.0!aws-cdk-lib.service.Resource, 0.42.1!aws-cdk-lib-experiments.NewStuff]
 * Becomes:
 * 1.90.0!aws-cdk-lib.{Stack,Construct,service.Resource},0.42.1!aws-cdk-lib-experiments.NewStuff
 *
 * The whole thing is then compressed and base64-encoded, and then formatted as:
 * v2:deflate64:{prefixEncodedListCompressedAndEncoded}
 *
 * The appinfo section is optional, and currently only added if the app was generated using `cdk migrate`
 * It is also compressed and base64-encoded. In this case, the string will be formatted as:
 * v2:deflate64:{prefixEncodedListCompressedAndEncoded}:{'cdk-migrate'CompressedAndEncoded}
 *
 * Exported/visible for ease of testing.
 */
export function formatAnalytics(infos: ConstructInfo[], enableAdditionalTelemtry: boolean = false) {
  const trie = new Trie();

  // only append additional telemetry information to prefix encoding and gzip compress
  // if feature flag is enabled; otherwise keep the old behaviour.
  if (enableAdditionalTelemtry) {
    infos.forEach(info => insertFqnInTrie(`${info.version}!${info.fqn}`, trie, info.metadata));
  } else {
    infos.forEach(info => insertFqnInTrie(`${info.version}!${info.fqn}`, trie));
  }

  const plaintextEncodedConstructs = prefixEncodeTrie(trie);
  const compressedConstructsBuffer = zlib.gzipSync(Buffer.from(plaintextEncodedConstructs));

  // set OS flag to "unknown" in order to ensure we get consistent results across operating systems
  // see https://github.com/aws/aws-cdk/issues/15322
  setGzipOperatingSystemToUnknown(compressedConstructsBuffer);

  const compressedConstructs = compressedConstructsBuffer.toString('base64');
  const analyticsString = `v2:deflate64:${compressedConstructs}`;

  if (process.env.CDK_CONTEXT_JSON && JSON.parse(process.env.CDK_CONTEXT_JSON)['cdk-migrate']) {
    const compressedAppInfoBuffer = zlib.gzipSync(Buffer.from('cdk-migrate'));
    const compressedAppInfo = compressedAppInfoBuffer.toString('base64');
    analyticsString.concat(':', compressedAppInfo);
  }

  return analyticsString;
}

/**
 * Splits after non-alphanumeric characters (e.g., '.', '/') in the FQN
 * and insert each piece of the FQN in nested map (i.e., simple trie).
 */
function insertFqnInTrie(fqn: string, trie: Trie, metadata?: Record<string, any>[]) {
  for (const fqnPart of fqn.replace(/[^a-z0-9]/gi, '$& ').split(' ')) {
    const nextLevelTreeRef = trie.get(fqnPart) ?? new Trie();
    trie.set(fqnPart, nextLevelTreeRef);
    trie = nextLevelTreeRef;
  }

  // if 'metadata' is defined, add it to end of Trie
  if (metadata) {
    trie.set(JSON.stringify(metadata), new Trie());
  }
  return trie;
}

/**
 * Prefix-encodes a "trie-ish" structure, using '{}' to group and ',' to separate siblings.
 *
 * Example input:
 * ABC,ABD,AEF
 *
 * Example trie:
 * A --> B --> C
 *  |     \--> D
 *  \--> E --> F
 *
 * Becomes:
 * A{B{C,D},EF}
 */
function prefixEncodeTrie(trie: Trie) {
  let prefixEncoded = '';
  let isFirstEntryAtLevel = true;
  [...trie.entries()].forEach(([key, value]) => {
    if (!isFirstEntryAtLevel) {
      prefixEncoded += ',';
    }
    isFirstEntryAtLevel = false;
    prefixEncoded += key;
    if (value.size > 1) {
      prefixEncoded += '{';
      prefixEncoded += prefixEncodeTrie(value);
      prefixEncoded += '}';
    } else {
      prefixEncoded += prefixEncodeTrie(value);
    }
  });
  return prefixEncoded;
}

/**
 * Sets the OS flag to "unknown" in order to ensure we get consistent results across operating systems.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc1952#page-5
 *
 *   +---+---+---+---+---+---+---+---+---+---+
 *   |ID1|ID2|CM |FLG|     MTIME     |XFL|OS |
 *   +---+---+---+---+---+---+---+---+---+---+
 *   | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
 *   +---+---+---+---+---+---+---+---+---+---+
 *
 * OS (Operating System)
 * =====================
 * This identifies the type of file system on which compression
 * took place.  This may be useful in determining end-of-line
 * convention for text files.  The currently defined values are
 * as follows:
 *      0 - FAT filesystem (MS-DOS, OS/2, NT/Win32)
 *      1 - Amiga
 *      2 - VMS (or OpenVMS)
 *      3 - Unix
 *      4 - VM/CMS
 *      5 - Atari TOS
 *      6 - HPFS filesystem (OS/2, NT)
 *      7 - Macintosh
 *      8 - Z-System
 *      9 - CP/M
 *     10 - TOPS-20
 *     11 - NTFS filesystem (NT)
 *     12 - QDOS
 *     13 - Acorn RISCOS
 *    255 - unknown
 *
 * @param gzipBuffer A gzip buffer
 */
function setGzipOperatingSystemToUnknown(gzipBuffer: Buffer) {
  // check that this is indeed a gzip buffer (https://datatracker.ietf.org/doc/html/rfc1952#page-6)
  if (gzipBuffer[0] !== 0x1f || gzipBuffer[1] !== 0x8b) {
    throw new AssumptionError('Expecting a gzip buffer (must start with 0x1f8b)');
  }

  gzipBuffer[9] = 255;
}
