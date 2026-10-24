const TEXT_NAME = new RegExp('(?:^|[a-z])(?:Label|Title|Message|Description|Placeholder|HelperText|ButtonText)$'
  + '|^(label|title|message|description|placeholder|helperText|alt|text|aria-label)$');
const TEXT_CALL = /^(?:set.*(?:Label|Title|Message|Description|HelperText)|alert|confirm|prompt|enqueueSnackbar|notify)$/;
const VALIDATION_CALL = /^(min|max|length|email|url|regex|refine|nonempty)$/;

function nameOf(node) {
  return node?.type === 'Identifier' ? node.name : node?.type === 'Literal' ? node.value : undefined;
}

function callName(node) {
  return node.type === 'Identifier' ? node.name
    : node.type === 'MemberExpression' ? `${callName(node.object)}.${nameOf(node.property)}` : '';
}

function functionName(node) {
  return nameOf(node?.id) ?? (node?.parent.type === 'VariableDeclarator' ? nameOf(node.parent.id)
    : node?.parent.type === 'Property' ? nameOf(node.parent.key) : '');
}

function textLiterals(node, out = []) {
  if (!node) {
    return out;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    out.push({ node, text: node.value });
  } else if (node.type === 'TemplateLiteral') {
    out.push({ node, text: node.quasis.map((part) => part.value.cooked ?? part.value.raw).join('') });
  } else if (node.type === 'ConditionalExpression') {
    textLiterals(node.consequent, out);
    textLiterals(node.alternate, out);
  } else if (node.type === 'LogicalExpression' || (node.type === 'BinaryExpression' && node.operator === '+')) {
    textLiterals(node.left, out);
    textLiterals(node.right, out);
  } else if (['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'].includes(node.type)) {
    textLiterals(node.expression, out);
  }
  return out;
}

function definition(context, node) {
  for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(node.name);
    if (variable) {
      return variable.defs.length === 1 ? variable.defs[0].node : undefined;
    }
  }
  return undefined;
}

function finiteValues(context, type, seen = new Set()) {
  if (!type || seen.has(type)) {
    return undefined;
  }
  seen.add(type);
  if (type.type === 'TSLiteralType' && typeof type.literal.value === 'string') {
    return [type.literal.value];
  }
  if (['TSNullKeyword', 'TSUndefinedKeyword'].includes(type.type)) {
    return [];
  }
  if (type.type === 'TSUnionType') {
    const values = type.types.map((part) => finiteValues(context, part, new Set(seen)));
    return values.every((part) => part !== undefined) ? values.flat() : undefined;
  }
  if (type.type === 'TSTypeReference' && type.typeName.type === 'Identifier') {
    const declared = definition(context, type.typeName);
    return declared?.type === 'TSTypeAliasDeclaration' ? finiteValues(context, declared.typeAnnotation, seen) : undefined;
  }
  return undefined;
}

function stateValues(context, call) {
  if (call.callee.type !== 'Identifier') {
    return undefined;
  }
  const declared = definition(context, call.callee);
  if (declared?.type !== 'VariableDeclarator' || declared.id.type !== 'ArrayPattern'
    || declared.id.elements[1]?.name !== call.callee.name || declared.init?.type !== 'CallExpression'
    || !/^(React\.)?useState$/.test(callName(declared.init.callee))) {
    return undefined;
  }
  return finiteValues(context, declared.init.typeArguments?.params[0]);
}

function isTechnicalText(text) {
  return !/[a-zA-Z]/.test(text.replace(/<[^>]*>/g, '')) || /^(?:https?|wss?):\/\//.test(text)
    || /^[A-Z][\w]*(?:\.[\w-]+)+\.?$/.test(text) || /^(?:text|bg|border)-[a-z0-9/-]+$/.test(text);
}

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: { untranslated: 'Translate user-visible text with t(): {{text}}' },
  },
  create(context) {
    const reported = new WeakSet();
    const check = (node, excluded = []) => {
      if (!node) {
        return;
      }
      const allAncestors = context.sourceCode.getAncestors(node);
      const boundary = allAncestors.findLastIndex((ancestor) =>
        ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(ancestor.type));
      const ancestors = allAncestors.slice(boundary + 1);
      if (ancestors.some((ancestor) => ancestor.type.startsWith('JSX') || ancestor.type.startsWith('TSEnum')
        || (ancestor.type === 'CallExpression' && /^(?:(?:.*\.)?t|(?:console|logger|debugLog)\..*)$/.test(callName(ancestor.callee))))) {
        return;
      }
      for (const literal of textLiterals(node)) {
        if (reported.has(literal.node) || isTechnicalText(literal.text) || excluded.includes(literal.text)) {
          continue;
        }
        reported.add(literal.node);
        context.report({ node: literal.node, messageId: 'untranslated', data: { text: literal.text } });
      }
    };
    return {
      Property(node) {
        if (!node.computed && TEXT_NAME.test(nameOf(node.key) ?? '')) {
          const object = node.parent;
          const call = object.parent;
          const directCall = object.type === 'ObjectExpression' && call.type === 'CallExpression' && call.arguments.includes(object);
          if (directCall && /^(debug|log|info|warn|error|trace)$/.test(callName(call.callee))) {
            return;
          }
          if (nameOf(node.key) === 'title' && node.value.type === 'Literal' && /^[a-z][a-z0-9_-]*$/.test(node.value.value)
            && !(directCall && /(?:prompt|alert|confirm|notify|toast|snackbar|dialog)/i.test(callName(call.callee)))) {
            return;
          }
          check(node.value);
        }
      },
      VariableDeclarator(node) {
        if (TEXT_NAME.test(nameOf(node.id) ?? '')) {
          check(node.init);
        } else if (node.id.type === 'ArrayPattern' && TEXT_NAME.test(nameOf(node.id.elements[0]) ?? '')
          && node.init?.type === 'CallExpression' && /^(React\.)?useState$/.test(callName(node.init.callee))) {
          check(node.init.arguments[0], finiteValues(context, node.init.typeArguments?.params[0]));
        }
      },
      AssignmentExpression(node) {
        const name = node.left.type === 'MemberExpression' ? nameOf(node.left.property) : nameOf(node.left);
        if (TEXT_NAME.test(name ?? '')) {
          check(node.right);
        }
      },
      ReturnStatement(node) {
        const owner = context.sourceCode.getAncestors(node).findLast((ancestor) =>
          ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(ancestor.type));
        const name = functionName(owner);
        if (TEXT_NAME.test(name) || name === 'validate') {
          check(node.argument);
        }
      },
      ArrowFunctionExpression(node) {
        const name = functionName(node);
        if (TEXT_NAME.test(name) || name === 'validate') {
          check(node.body);
        }
      },
      CallExpression(node) {
        const name = callName(node.callee);
        const method = name.split('.').at(-1);
        if (TEXT_CALL.test(method) || /^(?:toast|notify)(?:\.(?:error|success|info|warning))?$/.test(name)) {
          check(node.arguments[0], stateValues(context, node));
        } else if (method === 'setError' && node.arguments.length === 1) {
          check(node.arguments[0]);
        } else if (node.callee.type === 'MemberExpression' && VALIDATION_CALL.test(method)
          && /^z\./.test(context.sourceCode.getText(node.callee.object))) {
          check(node.arguments.at(-1));
        }
      },
    };
  },
};
