import { vnode, VNode } from "./vnode";

type NonUndefined<T> = T extends undefined ? never : T;

function sameVnode(oldVnode, newVnode) {
  return newVnode.sel === oldVnode.sel && newVnode.key === oldVnode.key;
}

function isVnode(vnode): vnode is VNode {
  return vnode.sel !== undefined;
}

/**
 *
 * @param {VNode} vnode
 * @description 递归创建真实dom树
 */
function createElement(vnode: VNode): Node {
  const sel = vnode.sel;
  const elm = document.createElement(sel);
  const children = vnode.children;
  const text = vnode.text;

  if (Array.isArray(children)) {
    for (let i = 0, len = children.length; i < len; i++) {
      const ch = children[i];
      elm.appendChild(createElement(ch as VNode));
    }
  } else {
    const textContent = document.createTextNode(text);
    elm.appendChild(textContent);
  }

  return elm;
}

function emptyNodeAt(Ele: Element) {
  const sel = Ele.tagName;
  return vnode(sel, {}, [], undefined, Ele);
}

function isUndef(s: any): s is undefined {
  return s === undefined;
}

function isDef<T>(s): s is NonUndefined<T> {
  return s !== undefined;
}

function removeVNodes(parent: Node, vnodes: VNode[]) {
  for (let i = vnodes.length; i >= 0; i++) {
    const ch = vnodes[i];
    parent.removeChild(ch.elm);
  }
}

function addVNodes(parent: Node, vnodes: VNode[], before?: Node) {
  for (let i = 0, len = vnodes.length; i < len; i++) {
    const ch = vnodes[i];
    // parent.appendChild(ch.elm);
    parent.insertBefore(ch.elm, before);
  }
}

/**
 *
 * @param children
 * @param beginIdx
 * @param endIdx
 * @description 返回区间内key对应的map集合
 */
function createKeyToOldIdx(
  children: VNode[],
  beginIdx: number,
  endIdx: number
) {
  const map = {};

  for (let i = beginIdx; i <= endIdx; i++) {
    const key = children[i].key;
    if (key !== undefined) {
      map[key as string] = i;
    }
  }

  return map;
}

function updateChildren(parentElm: Node, oldCh: VNode[], newCh: VNode[]) {
  // 四种命中查找
  // 只要命中1,则不会继续判断了
  // 命中完成之后 前节点 + 1,后节点 - 1;
  // 1.新前与旧前比较
  // 2.新后与旧后比较
  // 3.新后与旧前比较
  // 4.新前与旧后比较
  let oldStartIdx = 0,
    newStartIdx = 0,
    oldEndIdx = oldCh.length - 1,
    newEndIdx = newCh.length - 1;

  let newStartNode = newCh[0],
    newEndNode = newCh[newEndIdx],
    oldStartNode = oldCh[0],
    oldEndNode = oldCh[oldEndIdx];

  let oldKeyToIdx, idxInOld, elmToMove: VNode;

  while (newStartIdx <= newEndIdx && oldStartIdx <= oldEndIdx) {
    if (oldStartNode == null) {
      // 如果旧前节点为空
      oldStartNode = oldCh[++oldStartIdx]; // 向右移动
    } else if (oldEndNode == null) {
      oldEndNode = oldCh[--oldEndIdx]; //向左移动
    } else if (newStartNode == null) {
      newStartNode = newCh[++newStartIdx];
    } else if (newEndNode == null) {
      newEndNode = newCh[--newEndIdx];
    } else if (sameVnode(oldStartNode, newStartNode)) {
      // 规则1.旧前与新前比较 都 + 1
      patchVnode(oldStartNode, newStartNode);

      oldStartNode = oldCh[++oldStartIdx];
      newStartNode = newCh[++newStartIdx];
    } else if (sameVnode(oldEndNode, newEndNode)) {
      // 规则2 旧后与新后比较
      patchVnode(oldEndNode, newEndNode);

      oldEndNode = oldCh[--oldEndIdx]; //向左移动
      newEndNode = newCh[--newEndIdx];
    } else if (sameVnode(oldStartNode, newEndNode)) {
      //规则3  旧前与新后
      patchVnode(oldStartNode, newEndNode);

      //同时讲该几点移动到旧后之后
      // insertBefore的特殊性 需要调整一下位置
      parentElm.insertBefore(oldStartNode.elm, oldEndNode.elm.nextSibling);

      oldStartNode = oldCh[++oldStartIdx];
      newEndNode = newCh[--newEndIdx];
    } else if (sameVnode(oldEndNode, newStartNode)) {
      //规则四. 旧后与新前
      patchVnode(oldEndNode, newStartNode);

      // 同时将该节点移动至旧前之前

      parentElm.insertBefore(oldEndNode.elm, oldStartNode.elm);

      oldEndNode = oldCh[--oldEndIdx]; //向左移动
      newStartNode = newCh[++newStartIdx];
    } else {
      // 四个规则都不命中
      if (oldKeyToIdx === undefined) {
        oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
      }

      idxInOld = oldKeyToIdx[newStartNode.key as string];

      if (isUndef(idxInOld)) {
        //不存在该节点
        // 说明是一个新节点
        parentElm.insertBefore(createElement(newStartNode), oldStartNode.elm);
      } else {
        // 如果存在 先将此位置 填为空
        elmToMove = oldCh[idxInOld]; //获取要移动的节点

        if (elmToMove.sel !== newStartNode.sel) {
          // 这里意味着不是同一个节点,
          //
          parentElm.insertBefore(
            createElement(newStartNode),
            oldStartNode.elm!
          );
        } else {
          // 如果是同一个节点,但我不能保证他们的孩子没有任何变化,所以需要patchVnode 一下(只要是相同节点)
          patchVnode(elmToMove, newStartNode);
          oldCh[idxInOld] = undefined as any; // 将当前匹配到节点设为undefined
          // 同时在旧前之后插入
          parentElm.insertBefore(elmToMove.elm, oldStartNode.elm);
        }
      }
      newStartNode = newCh[++newStartIdx]; //这里应该必然会越界
    }
  }

  // 找完了(已越界)
  if (newStartIdx <= newEndIdx || oldStartIdx <= oldEndIdx) {
    if (oldStartIdx > oldEndIdx) {
      // 这里说明 新前与新后之间至少还有1个节点 新增
      const before =
        newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
      // 如果存在这个节点 那么肯定是在这个节点之前插入
      addVNodes(parentElm, newCh.slice(newStartIdx, newEndIdx + 1), before);
    } else {
      // 旧前与旧后 之间还有节点  删除
      removeVNodes(parentElm, oldCh.slice(oldStartIdx, oldEndIdx + 1));
    }
  }
}

function patchVnode(oldVnode: VNode, newVnode: VNode) {
  const oldch = oldVnode.children as VNode[];
  const ch = newVnode.children as VNode[];

  const elm = oldVnode.elm;

  if (oldVnode === newVnode) return; // 如果vnode 都指向同一个内存 没必要比较了
  if (isUndef(newVnode.text)) {
    // 这里由于 text 和 children 互斥,可以得出 isDef(ch) 为true
    if (isDef(oldch) && isDef(ch)) {
      //如果旧孩子有
      if (oldch !== ch) updateChildren(elm, oldch, ch);
    } else if (isDef(ch)) {
      //  如果新孩子有 ps:且旧节点有text属性(说明旧节点没有children属性)
      if (isDef(oldVnode.text)) elm.textContent = "";
      // 然后直接替换
      addVNodes(elm, ch);
    } else if (isDef(oldch)) {
      // 如果新节点的text没有 并且没有children 同时旧节点有孩子节点
      // 这个步骤不知道???
      removeVNodes(elm, oldch);
    } else if (isDef(oldVnode.text)) {
      elm.textContent = "";
    }
  } else if (oldVnode.text !== newVnode.text) {
    // newnode 有text 节点
    // 且 不与新节点相同 ps. 相同就不需要做啥操作
    // 有可能旧节点有children
    if (isDef(oldch)) {
      removeVNodes(elm, oldch);
    }
    // 直接替换
    elm.textContent = newVnode.text;
  }
}

function patch(oldVnode: VNode | Element, vnode: VNode) {
  let elm: Node, parent: Node;

  if (!isVnode(oldVnode)) {
    // 第一次上树
    oldVnode = emptyNodeAt(oldVnode as Element); // 将该真实dom 转化为 虚拟dom
  }

  if (sameVnode(oldVnode, vnode)) {
    patchVnode(oldVnode, vnode);
  } else {
    // 如果不是同一节点 直接暴力删除,并添加
    elm = oldVnode.elm;

    parent = elm.parentNode;

    createElement(vnode); // 根据新vnode 生成 dom (递归)

    // 如果父节点存在(必然存在)
    if (parent !== null) {
      parent.insertBefore(vnode.elm, elm);
      // 然后删除
      parent.removeChild(elm);
    }
  }

  return vnode;
}
